"""Runs a provider, executes its tool calls, persists everything and streams AgentEvents."""

import logging
import uuid
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.agent.context import PageContext
from app.agent.events import (
    AnyEvent,
    CardEvent,
    ErrorEvent,
    MessageEndEvent,
    MessageStartEvent,
    PlanEvent,
    PlanStepOut,
    ThinkingEvent,
    TokenEvent,
    ToolCallEvent,
    ToolResultEvent,
    UIAction,
    UIActionEvent,
)
from app.agent.providers.base import (
    CardStep,
    ConversationState,
    HistoryMessage,
    LLMProvider,
    PlanStep,
    ProviderRun,
    StoredPlan,
    SuggestionsStep,
    TextStep,
    ThinkingStep,
    ToolCallStep,
    ToolOutcome,
    UIActionStep,
    plan_to_payload,
)
from app.agent.tools import Tool, ToolContext, ToolRegistry, ToolResult
from app.errors import AppError, ConflictError, NotFoundError
from app.models import AgentAction, AgentConversation, AgentMessage, AgentPlan
from app.models.base import utcnow
from app.services.context import Ctx

log = logging.getLogger(__name__)
_ui_adapter: TypeAdapter[UIAction] = TypeAdapter(UIAction)
_HEAVY_KEYS = {"activities", "body"}
MUTATION_NEEDS_PLAN = "This change needs an approved plan first."


@dataclass(frozen=True)
class AgentUser:
    user_id: uuid.UUID
    workspace_id: uuid.UUID
    full_name: str
    terminology: dict[str, str]


def _public(data: dict[str, Any]) -> dict[str, Any]:
    """Slim tool data for the client (cards carry the rich payloads)."""
    out = {k: v for k, v in data.items() if k not in _HEAVY_KEYS and k != "ui_actions"}
    if isinstance(out.get("items"), list):
        out["items"] = out["items"][:10]
    return out


def _compact(events: list[AnyEvent]) -> list[dict[str, Any]]:
    """Merge consecutive token events so stored transcripts stay small."""
    out: list[dict[str, Any]] = []
    for ev in events:
        dumped = ev.model_dump(mode="json")
        if dumped["type"] == "token" and out and out[-1]["type"] == "token":
            out[-1]["text"] += dumped["text"]
        else:
            out.append(dumped)
    return out


class Orchestrator:
    def __init__(
        self, maker: async_sessionmaker[AsyncSession], provider: LLMProvider, registry: ToolRegistry
    ) -> None:
        self.maker = maker
        self.provider = provider
        self.registry = registry

    # ---- public entry points ----------------------------------------------------------------

    async def chat(
        self,
        user: AgentUser,
        message: str,
        page: PageContext,
        conversation_id: uuid.UUID | None = None,
    ) -> AsyncIterator[AnyEvent]:
        async with self.maker() as session:
            conv = await self._conversation(session, user, conversation_id, message)
            history = await self._history(session, conv.id)
            session.add(
                AgentMessage(conversation_id=conv.id, role="user", content=message, events=[])
            )
            await session.commit()
            state = ConversationState(
                conversation_id=conv.id,
                message=message,
                history=history,
                user_name=user.full_name,
                terminology=user.terminology,
            )
            run = self.provider.run(state, page, self.registry)
            async for ev in self._drive(
                session, user, conv.id, None, run, page, allow_mutations=False
            ):
                yield ev

    async def prepare_plan(self, user: AgentUser, plan_id: uuid.UUID) -> AgentPlan:
        async with self.maker() as session:
            plan = await self._plan(session, user, plan_id)
            if plan.status != "proposed":
                raise ConflictError(f"This plan was already {plan.status}")
            return plan

    async def approve(
        self, user: AgentUser, plan_id: uuid.UUID, page: PageContext
    ) -> AsyncIterator[AnyEvent]:
        async with self.maker() as session:
            plan = await self._plan(session, user, plan_id)
            if plan.status != "proposed":
                yield ErrorEvent(message=f"This plan was already {plan.status}.")
                return
            plan.status = "approved"
            await session.commit()
            stored = StoredPlan(plan_id=plan.id, title=plan.title, payload=dict(plan.steps))
            run = self.provider.execute_plan(stored, page, self.registry)
            async for ev in self._drive(
                session, user, plan.conversation_id, plan.id, run, page, allow_mutations=True
            ):
                yield ev
            plan.status = "executed"
            await session.commit()

    async def reject(self, user: AgentUser, plan_id: uuid.UUID) -> None:
        async with self.maker() as session:
            plan = await self._plan(session, user, plan_id)
            if plan.status != "proposed":
                raise ConflictError(f"This plan was already {plan.status}")
            plan.status = "rejected"
            session.add(
                AgentMessage(
                    conversation_id=plan.conversation_id,
                    role="assistant",
                    content="Okay — I won't make those changes.",
                    events=[{"type": "token", "text": "Okay — I won't make those changes."}],
                )
            )
            await session.commit()

    async def stream_unsaved(
        self, user: AgentUser, run: ProviderRun, page: PageContext
    ) -> AsyncIterator[AnyEvent]:
        """Run a read-only provider flow without persisting a conversation (e.g. the briefing)."""
        async with self.maker() as session:
            async for ev in self._drive(
                session, user, None, None, run, page, allow_mutations=False
            ):
                yield ev

    # ---- core loop -----------------------------------------------------------------------------

    async def _drive(
        self,
        session: AsyncSession,
        user: AgentUser,
        conversation_id: uuid.UUID | None,
        plan_id: uuid.UUID | None,
        run: ProviderRun,
        page: PageContext,
        *,
        allow_mutations: bool,
    ) -> AsyncIterator[AnyEvent]:
        message_id = uuid.uuid4()
        recorded: list[AnyEvent] = []
        undo_ids: list[str] = []
        suggestions: list[str] | None = None
        ctx = Ctx(
            session=session,
            workspace_id=user.workspace_id,
            user_id=user.user_id,
            actor_type="agent",
        )
        tctx = ToolContext(
            ctx=ctx, conversation_id=conversation_id, plan_id=plan_id, timezone=page.timezone
        )

        def emit(ev: AnyEvent) -> AnyEvent:
            recorded.append(ev)
            return ev

        yield emit(
            MessageStartEvent(
                message_id=str(message_id),
                conversation_id=str(conversation_id) if conversation_id else None,
            )
        )
        outcome: ToolOutcome | None = None
        try:
            while True:
                try:
                    step = await run.asend(outcome)
                except StopAsyncIteration:
                    break
                outcome = None
                if isinstance(step, TextStep):
                    yield emit(TokenEvent(text=step.text))
                elif isinstance(step, ThinkingStep):
                    yield emit(ThinkingEvent(label=step.label))
                elif isinstance(step, UIActionStep):
                    yield emit(UIActionEvent(action=_ui_adapter.validate_python(step.action)))
                elif isinstance(step, CardStep):
                    yield emit(CardEvent(kind=step.kind, data=step.data))
                elif isinstance(step, SuggestionsStep):
                    suggestions = step.prompts
                elif isinstance(step, PlanStep):
                    yield emit(await self._propose(session, conversation_id, step))
                elif isinstance(step, ToolCallStep):
                    call_id = uuid.uuid4().hex[:12]
                    tool = self.registry.get(step.tool)
                    try:
                        args = tool.parse(step.args)
                        label = step.label or tool.describe(args, user.terminology)
                    except ValidationError as exc:
                        yield emit(
                            ToolCallEvent(
                                call_id=call_id, tool=step.tool, label=tool.label, args=step.args
                            )
                        )
                        msg = f"Invalid arguments: {exc.errors()[0].get('msg', '')}"
                        yield emit(ToolResultEvent(call_id=call_id, ok=False, summary=msg))
                        outcome = ToolOutcome(ok=False, summary=msg, data={})
                        continue
                    yield emit(
                        ToolCallEvent(
                            call_id=call_id,
                            tool=tool.name,
                            label=label,
                            args=args.model_dump(mode="json", exclude_none=True),
                        )
                    )
                    result = await self._execute(
                        session, tctx, tool, args, step, allow_mutations, undo_ids
                    )
                    yield emit(
                        ToolResultEvent(
                            call_id=call_id,
                            ok=result.ok,
                            summary=result.summary,
                            data=_public(result.data),
                        )
                    )
                    for raw in result.data.get("ui_actions", []) if result.ok else []:
                        yield emit(UIActionEvent(action=_ui_adapter.validate_python(raw)))
                    outcome = ToolOutcome(ok=result.ok, summary=result.summary, data=result.data)
        except Exception:
            log.exception("agent run failed")
            await session.rollback()
            yield emit(
                ErrorEvent(message="Something went wrong on my side. Nothing else was changed.")
            )
        yield emit(
            MessageEndEvent(
                message_id=str(message_id),
                undo_action_ids=undo_ids or None,
                suggestions=suggestions,
            )
        )
        if conversation_id is not None:
            content = "".join(e.text for e in recorded if isinstance(e, TokenEvent))
            session.add(
                AgentMessage(
                    id=message_id,
                    conversation_id=conversation_id,
                    role="assistant",
                    content=content,
                    events=_compact(recorded),
                )
            )
            conv = await session.get(AgentConversation, conversation_id)
            if conv is not None:
                conv.updated_at = utcnow()
            await session.commit()

    async def _execute(
        self,
        session: AsyncSession,
        tctx: ToolContext,
        tool: Tool[Any],
        args: BaseModel,
        step: ToolCallStep,
        allow_mutations: bool,
        undo_ids: list[str],
    ) -> ToolResult:
        if tool.mutating and not allow_mutations:
            return ToolResult(ok=False, summary=MUTATION_NEEDS_PLAN)
        try:
            result: ToolResult = await tool.run(tctx, args)
            if tool.mutating and result.ok:
                action = AgentAction(
                    workspace_id=tctx.ctx.workspace_id,
                    conversation_id=tctx.conversation_id,
                    plan_id=tctx.plan_id,
                    tool=tool.name,
                    args=args.model_dump(mode="json"),
                    result=_public(result.data),
                    inverse=tool.inverse(result),
                    undone=False,
                )
                session.add(action)
                await session.flush()
                undo_ids.append(str(action.id))
            # Commit per tool so ui_action invalidations refetch committed data.
            await session.commit()
            return result
        except AppError as exc:
            await session.rollback()
            return ToolResult(ok=False, summary=exc.message)

    # ---- persistence helpers ----------------------------------------------------------------

    async def _propose(
        self, session: AsyncSession, conversation_id: uuid.UUID | None, step: PlanStep
    ) -> PlanEvent:
        if conversation_id is None:
            raise RuntimeError("Plans need a conversation")
        payload = plan_to_payload(step)
        plan = AgentPlan(
            conversation_id=conversation_id, title=step.title, steps=payload, status="proposed"
        )
        session.add(plan)
        await session.commit()
        return PlanEvent(
            plan_id=str(plan.id),
            title=step.title,
            steps=[
                PlanStepOut(id=s["id"], label=s["label"], tool=s["tool"]) for s in payload["steps"]
            ],
        )

    async def _conversation(
        self,
        session: AsyncSession,
        user: AgentUser,
        conversation_id: uuid.UUID | None,
        message: str,
    ) -> AgentConversation:
        if conversation_id is not None:
            conv = await session.scalar(
                select(AgentConversation).where(
                    AgentConversation.id == conversation_id,
                    AgentConversation.workspace_id == user.workspace_id,
                    AgentConversation.user_id == user.user_id,
                )
            )
            if conv is None:
                raise NotFoundError("Conversation not found")
            return conv
        title = message.strip().replace("\n", " ")
        conv = AgentConversation(
            workspace_id=user.workspace_id,
            user_id=user.user_id,
            title=title[:57] + "…" if len(title) > 60 else title,
        )
        session.add(conv)
        await session.flush()
        return conv

    async def _history(
        self, session: AsyncSession, conversation_id: uuid.UUID
    ) -> list[HistoryMessage]:
        rows = await session.scalars(
            select(AgentMessage)
            .where(AgentMessage.conversation_id == conversation_id)
            .order_by(AgentMessage.created_at)
            .limit(40)
        )
        return [HistoryMessage(role=m.role, content=m.content) for m in rows.all()]

    async def _plan(self, session: AsyncSession, user: AgentUser, plan_id: uuid.UUID) -> AgentPlan:
        plan = await session.scalar(
            select(AgentPlan)
            .join(AgentConversation, AgentConversation.id == AgentPlan.conversation_id)
            .where(
                AgentPlan.id == plan_id,
                AgentConversation.workspace_id == user.workspace_id,
                AgentConversation.user_id == user.user_id,
            )
        )
        if plan is None:
            raise NotFoundError("Plan not found")
        return plan
