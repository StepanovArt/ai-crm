import random
import uuid
from collections.abc import AsyncIterator
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sse_starlette import EventSourceResponse

from app.agent.briefing import Briefing, compose_briefing
from app.agent.context import PageContext
from app.agent.events import AgentEvent, AnyEvent
from app.agent.insights import Insight, build_insight
from app.agent.orchestrator import AgentUser, Orchestrator
from app.agent.providers import get_provider
from app.agent.providers.base import ConversationState, ProviderRun, SuggestionsStep
from app.agent.scenarios import briefing as briefing_scenario
from app.agent.scenarios.kit import Kit, Pacer
from app.agent.serialize import contact_brief, deal_brief, task_brief
from app.agent.tools import default_registry
from app.agent.undo import undo_actions
from app.config import get_settings
from app.deps import AuthDep, CtxDep, SessionMakerDep
from app.errors import NotFoundError
from app.models import AgentAction, AgentConversation, AgentMessage, AgentPlan
from app.schemas.agent import (
    ApproveIn,
    ChatIn,
    ConversationDetailOut,
    ConversationOut,
    MessageOut,
    UndoIn,
    UndoOut,
)
from app.schemas.common import OkOut
from app.schemas.records import ContactFilter, DealFilter
from app.schemas.work import TaskFilter
from app.services import contacts as contacts_service
from app.services import deals as deals_service
from app.services import tasks as tasks_service
from app.services.listing import ListParams
from app.services.workspaces import effective_terminology

router = APIRouter(prefix="/agent", tags=["agent"])
SSE_RESPONSES: dict[int | str, dict[str, Any]] = {
    200: {"description": "Stream of AgentEvent JSON objects", "content": {"text/event-stream": {}}}
}


def get_orchestrator(maker: SessionMakerDep) -> Orchestrator:
    return Orchestrator(maker, get_provider(get_settings()), default_registry())


OrchestratorDep = Annotated[Orchestrator, Depends(get_orchestrator)]


def agent_user(auth: AuthDep) -> AgentUser:
    return AgentUser(
        user_id=auth.user.id,
        workspace_id=auth.workspace.id,
        full_name=auth.user.full_name,
        terminology=effective_terminology(auth.workspace.terminology),
    )


AgentUserDep = Annotated[AgentUser, Depends(agent_user)]


def _sse(events: AsyncIterator[AnyEvent]) -> EventSourceResponse:
    async def gen() -> AsyncIterator[dict[str, str]]:
        async for ev in events:
            yield {"data": ev.model_dump_json()}

    return EventSourceResponse(
        gen(), ping=15, headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"}
    )


@router.post("/chat", response_class=EventSourceResponse, responses=SSE_RESPONSES)
async def chat(body: ChatIn, user: AgentUserDep, orch: OrchestratorDep) -> EventSourceResponse:
    """Send a message to the agent. Streams AgentEvents (SSE)."""
    return _sse(orch.chat(user, body.message, body.context, body.conversation_id))


@router.post(
    "/plans/{plan_id}/approve", response_class=EventSourceResponse, responses=SSE_RESPONSES
)
async def approve_plan(
    plan_id: uuid.UUID, user: AgentUserDep, orch: OrchestratorDep, body: ApproveIn | None = None
) -> EventSourceResponse:
    """Approve a proposed plan and stream its execution (SSE)."""
    await orch.prepare_plan(user, plan_id)
    return _sse(orch.approve(user, plan_id, body.context if body else PageContext()))


@router.post("/plans/{plan_id}/reject", response_model=OkOut)
async def reject_plan(plan_id: uuid.UUID, user: AgentUserDep, orch: OrchestratorDep) -> OkOut:
    await orch.reject(user, plan_id)
    return OkOut()


@router.post("/actions/undo", response_model=UndoOut)
async def undo(body: UndoIn, ctx: CtxDep) -> UndoOut:
    assert ctx.user_id is not None
    undone, ui = await undo_actions(
        ctx.session, default_registry(), ctx.workspace_id, ctx.user_id, body.action_ids
    )
    return UndoOut.model_validate({"undone_action_ids": undone, "ui_actions": ui})


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(ctx: CtxDep) -> list[ConversationOut]:
    rows = await ctx.session.scalars(
        select(AgentConversation)
        .where(
            AgentConversation.workspace_id == ctx.workspace_id,
            AgentConversation.user_id == ctx.user_id,
        )
        .order_by(AgentConversation.updated_at.desc())
        .limit(30)
    )
    return [ConversationOut.model_validate(c, from_attributes=True) for c in rows.all()]


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailOut)
async def get_conversation(conversation_id: uuid.UUID, ctx: CtxDep) -> ConversationDetailOut:
    conv = await ctx.session.scalar(
        select(AgentConversation).where(
            AgentConversation.id == conversation_id,
            AgentConversation.workspace_id == ctx.workspace_id,
            AgentConversation.user_id == ctx.user_id,
        )
    )
    if conv is None:
        raise NotFoundError("Conversation not found")
    messages = (
        await ctx.session.scalars(
            select(AgentMessage)
            .where(AgentMessage.conversation_id == conv.id)
            .order_by(AgentMessage.created_at)
        )
    ).all()
    plans = (
        await ctx.session.execute(
            select(AgentPlan.id, AgentPlan.status).where(AgentPlan.conversation_id == conv.id)
        )
    ).all()
    undone = (
        await ctx.session.scalars(
            select(AgentAction.id).where(
                AgentAction.conversation_id == conv.id, AgentAction.undone.is_(True)
            )
        )
    ).all()
    return ConversationDetailOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[MessageOut.model_validate(m, from_attributes=True) for m in messages],
        plan_status={str(pid): status for pid, status in plans},
        undone_action_ids=[str(a) for a in undone],
    )


@router.get("/insights", response_model=Insight)
async def insights(
    ctx: CtxDep,
    record_type: Literal["company", "contact", "deal"],
    record_id: uuid.UUID,
) -> Insight:
    """Inline AI insight (summary + next step) for a record page."""
    return await build_insight(ctx, record_type, record_id)


@router.get("/briefing", response_model=Briefing)
async def briefing(
    ctx: CtxDep, auth: AuthDep, timezone: Annotated[str | None, Query()] = None
) -> Briefing:
    """Structured daily briefing for the Today page."""
    terms = effective_terminology(auth.workspace.terminology)
    overdue, _ = await tasks_service.list_tasks(
        ctx,
        ListParams(limit=10, sort="due_at"),
        TaskFilter(bucket="overdue", assignee_id=ctx.user_id),
    )
    today, _ = await tasks_service.list_tasks(
        ctx,
        ListParams(limit=10, sort="due_at"),
        TaskFilter(bucket="today", assignee_id=ctx.user_id),
    )
    hot, hot_total = await contacts_service.list_contacts(
        ctx, ListParams(limit=5, sort="-score"), ContactFilter(score_min=70)
    )
    stale, stale_total = await deals_service.list_deals(
        ctx, ListParams(limit=5, sort="last_activity_at"), DealFilter(stale_days=7)
    )
    return compose_briefing(
        first_name=auth.user.full_name.split()[0],
        tz=timezone,
        terms=terms,
        tasks_today=[task_brief(t) for t in today],
        tasks_overdue=[task_brief(t) for t in overdue],
        hot=[contact_brief(c) for c in hot],
        hot_total=hot_total,
        stale=[deal_brief(d) for d in stale],
        stale_total=stale_total,
    )


@router.get("/briefing/stream", response_class=EventSourceResponse, responses=SSE_RESPONSES)
async def briefing_stream(
    user: AgentUserDep, orch: OrchestratorDep, timezone: Annotated[str | None, Query()] = None
) -> EventSourceResponse:
    """The same briefing, streamed like an agent reply (not saved to a conversation)."""
    page = PageContext(route="/today", timezone=timezone)
    state = ConversationState(
        uuid.uuid4(), "What's on my plate today?", [], user.full_name, user.terminology
    )
    settings = get_settings()
    kit = Kit(
        conv=state,
        ctx=page,
        tools=orch.registry,
        pacer=Pacer(settings.agent_delay_scale, random.Random()),
    )

    async def run() -> ProviderRun:
        inner = briefing_scenario.run(kit)
        outcome = None
        while True:
            try:
                step = await inner.asend(outcome)
            except StopAsyncIteration:
                return
            if isinstance(step, SuggestionsStep):
                continue
            outcome = yield step

    return _sse(orch.stream_unsaved(user, run(), page))


@router.get("/events/schema", response_model=list[AgentEvent], include_in_schema=True)
async def events_schema() -> list[AgentEvent]:
    """Exposes the AgentEvent union in OpenAPI so the web client gets generated types."""
    return []
