"""Real LLM provider for any OpenAI-compatible Chat Completions API (`LLM_PROVIDER=openai`).

The model gets the same tools as the mock, as functions:
- read-only tools (search, get, stats, summaries, drafts, navigate) are called directly;
- mutating tools are only reachable through `propose_plan`, which becomes the same stored
  plan the mock produces. Approval, execution, ui_actions and exact undo are shared, so the
  "plan → approve → act → undo" contract holds no matter which model is behind it.

The demo never needs this: the mock provider is the default.
"""

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.agent.cards import ChartCard, ChartSeriesItem, ChartTotals, RecordItem, RecordsCard
from app.agent.context import PageContext
from app.agent.providers.base import (
    CardStep,
    ConversationState,
    PlannedStep,
    PlanStep,
    ProviderRun,
    StoredPlan,
    TextStep,
    ThinkingStep,
    ToolCallStep,
    ToolOutcome,
)
from app.agent.providers.mock import MockProvider
from app.agent.tools import ToolRegistry
from app.config import Settings

log = logging.getLogger(__name__)

MAX_ROUNDS = 6
MAX_TOOL_RESULT_CHARS = 6000
PROPOSE_PLAN = "propose_plan"


@dataclass
class _ToolCall:
    id: str = ""
    name: str = ""
    arguments: str = ""


@dataclass
class _Completion:
    text: str = ""
    tool_calls: list[_ToolCall] = field(default_factory=list)


class OpenAICompatProvider:
    def __init__(
        self, settings: Settings, *, transport: httpx.AsyncBaseTransport | None = None
    ) -> None:
        self.base_url = settings.openai_base_url.rstrip("/")
        self.api_key = settings.openai_api_key
        self.model = settings.openai_model
        self.transport = transport
        # Approved plans run through the provider-agnostic executor.
        self._executor = MockProvider(delay_scale=settings.agent_delay_scale)

    def execute_plan(self, plan: StoredPlan, ctx: PageContext, tools: ToolRegistry) -> ProviderRun:
        return self._executor.execute_plan(plan, ctx, tools)

    async def run(
        self, conv: ConversationState, ctx: PageContext, tools: ToolRegistry
    ) -> ProviderRun:
        if not self.api_key:
            yield TextStep("The OpenAI-compatible provider needs `OPENAI_API_KEY` to be set.")
            return
        messages: list[dict[str, Any]] = [
            {"role": "system", "content": _system_prompt(conv, ctx)},
            *({"role": m.role, "content": m.content} for m in conv.history[-12:]),
            {"role": "user", "content": conv.message},
        ]
        functions = _functions(tools)
        for _ in range(MAX_ROUNDS):
            yield ThinkingStep("Thinking")
            completion = _Completion()
            try:
                async for step in self._stream(messages, functions, completion):
                    yield step
            except httpx.HTTPError as exc:
                log.warning("LLM request failed: %s", exc)
                yield TextStep(f"I couldn't reach the language model ({_reason(exc)}).")
                return
            if not completion.tool_calls:
                return
            messages.append(_assistant_message(completion))
            for call in completion.tool_calls:
                args = _loads(call.arguments)
                if call.name == PROPOSE_PLAN:
                    plan, error = _build_plan(args, tools)
                    if plan is not None:
                        if completion.text:
                            yield TextStep("\n\n")
                        yield plan
                        return
                    content = json.dumps({"ok": False, "error": error})
                elif call.name not in tools or tools.get(call.name).mutating:
                    content = json.dumps(
                        {"ok": False, "error": f"Unknown or mutating tool: {call.name}"}
                    )
                else:
                    outcome = yield ToolCallStep(call.name, args)
                    for card in _cards(call.name, outcome):
                        yield card
                    content = _tool_content(outcome)
                messages.append({"role": "tool", "tool_call_id": call.id, "content": content})
        yield TextStep("\n\nI stopped after several lookups — try a more specific question.")

    async def _stream(
        self,
        messages: list[dict[str, Any]],
        functions: list[dict[str, Any]],
        out: _Completion,
    ) -> AsyncIterator[TextStep]:
        """POST /chat/completions with stream=true; yield text deltas, collect tool calls."""
        body = {
            "model": self.model,
            "messages": messages,
            "tools": functions,
            "tool_choice": "auto",
            "stream": True,
            "temperature": 0.2,
        }
        headers = {"Authorization": f"Bearer {self.api_key}"}
        calls: dict[int, _ToolCall] = {}
        async with (
            httpx.AsyncClient(transport=self.transport, timeout=60) as client,
            client.stream(
                "POST", f"{self.base_url}/chat/completions", json=body, headers=headers
            ) as res,
        ):
            res.raise_for_status()
            async for line in res.aiter_lines():
                if not line.startswith("data:"):
                    continue
                data = line[5:].strip()
                if data == "[DONE]":
                    break
                choices = json.loads(data).get("choices") or [{}]
                delta = choices[0].get("delta") or {}
                if text := delta.get("content"):
                    out.text += text
                    yield TextStep(text)
                for tc in delta.get("tool_calls") or []:
                    call = calls.setdefault(int(tc.get("index", 0)), _ToolCall())
                    call.id = tc.get("id") or call.id
                    fn = tc.get("function") or {}
                    call.name += fn.get("name") or ""
                    call.arguments += fn.get("arguments") or ""
        out.tool_calls = [calls[i] for i in sorted(calls)]


# ---- prompt & schemas ------------------------------------------------------------------------


def _system_prompt(conv: ConversationState, ctx: PageContext) -> str:
    t = conv.terminology
    page = f"The user is on {ctx.route}"
    if ctx.record_type and ctx.record_id:
        page += f", looking at {ctx.record_type} {ctx.record_id}"
    if ctx.selected_ids:
        page += f", with {len(ctx.selected_ids)} rows selected ({', '.join(map(str, ctx.selected_ids[:10]))})"
    return (
        "You are Halo, the AI assistant inside a B2B CRM. You work alongside the user in the "
        f"interface. The user is {conv.user_name}. This workspace calls deals "
        f"“{t.get('deals', 'Deals')}”, companies “{t.get('companies', 'Companies')}” and contacts "
        f"“{t.get('contacts', 'Contacts')}”; use those words. {page}.\n\n"
        "Rules:\n"
        "- Look things up with the tools before answering. Never invent records, names or numbers.\n"
        "- You cannot change data directly. To create tasks, update records, move deals or add "
        f"notes, call `{PROPOSE_PLAN}` with the exact tool calls; the user approves the plan "
        "before anything runs, and every change can be undone.\n"
        "- Use `navigate` to take the user to the page you are talking about.\n"
        "- Be brief and concrete: a few sentences or a short list, key numbers in **bold**."
    )


def _functions(tools: ToolRegistry) -> list[dict[str, Any]]:
    read = [s for s in tools.schemas() if not tools.get(str(s["name"])).mutating]
    mutating = [s for s in tools.schemas() if tools.get(str(s["name"])).mutating]
    plan_fn = {
        "name": PROPOSE_PLAN,
        "description": (
            "Propose changes for the user to approve. Each step is one call to a mutating tool. "
            "Mutating tools and their argument schemas:\n"
            + "\n".join(
                f"- {s['name']}: {s['description']} Args schema: {json.dumps(s['parameters'])}"
                for s in mutating
            )
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string", "description": "Short plan title"},
                "summary": {"type": "string", "description": "What to say once it's done"},
                "steps": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "label": {"type": "string"},
                            "tool": {"type": "string", "enum": [s["name"] for s in mutating]},
                            "args": {"type": "object"},
                        },
                        "required": ["label", "tool", "args"],
                    },
                },
            },
            "required": ["title", "steps"],
        },
    }
    return [{"type": "function", "function": fn} for fn in [*read, plan_fn]]


# ---- helpers -------------------------------------------------------------------------------


def _build_plan(args: dict[str, Any], tools: ToolRegistry) -> tuple[PlanStep | None, str]:
    steps: list[PlannedStep] = []
    for raw in args.get("steps") or []:
        name = str(raw.get("tool", ""))
        if name not in tools or not tools.get(name).mutating:
            return None, f"Step tool must be one of the mutating tools, got {name!r}"
        tool = tools.get(name)
        try:
            parsed = tool.parse(dict(raw.get("args") or {}))
        except ValueError as exc:  # pydantic ValidationError
            return None, f"Invalid args for {name}: {exc}"
        step_args = parsed.model_dump(mode="json", exclude_none=True)
        before, after = _step_ui(name, step_args)
        steps.append(
            PlannedStep(
                label=str(raw.get("label") or tool.describe(parsed)),
                tool=name,
                args=step_args,
                before=before,
                after=after,
            )
        )
    if not steps:
        return None, "A plan needs at least one step"
    title = str(args.get("title") or "Proposed changes")
    return PlanStep(
        title=title, steps=steps, thinking=title, summary=str(args.get("summary") or "Done.")
    ), ""


def _step_ui(tool: str, args: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Make plan execution watchable: go where the change happens before making it."""
    if tool == "move_deal_stage":
        return [{"kind": "navigate", "href": "/pipeline"}], []
    record_type, record_id = args.get("record_type"), args.get("record_id")
    if tool in ("update_record", "add_note") and record_type and record_id:
        return [{"kind": "open_record", "record_type": record_type, "record_id": record_id}], []
    return [], []


def _cards(tool: str, outcome: ToolOutcome | None) -> list[CardStep]:
    """Show the same cards the mock scenarios show when the model uses these tools."""
    if outcome is None or not outcome.ok:
        return []
    d = outcome.data
    if tool == "pipeline_stats" and d.get("stages"):
        chart = ChartCard(
            title=f"{d['pipeline']['name']} by stage",
            currency=str(d["currency"]),
            series=[ChartSeriesItem.model_validate(s) for s in d["stages"]],
            totals=ChartTotals.model_validate(d),
        )
        return [CardStep("chart", chart.model_dump(mode="json"))]
    if tool == "draft_email" and d.get("subject"):
        return [CardStep("email_draft", d)]
    if tool == "search_records":
        items = [
            RecordItem(
                type=i["type"],
                id=i["id"],
                title=i["title"],
                subtitle=i.get("subtitle") or None,
                badge=f"Score {i['score']}" if i.get("score") is not None else None,
                href=i["href"],
            )
            for i in d.get("items", [])
            if i.get("href") and i.get("type") in ("deal", "contact", "company")
        ][:6]
        if len(items) > 1:
            card = RecordsCard(title=outcome.summary, items=items)
            return [CardStep("records", card.model_dump(mode="json"))]
    return []


def _tool_content(outcome: ToolOutcome | None) -> str:
    if outcome is None:
        return json.dumps({"ok": False, "error": "No result"})
    data = {k: v for k, v in outcome.data.items() if k != "ui_actions"}
    text = json.dumps({"ok": outcome.ok, "summary": outcome.summary, "data": data}, default=str)
    return text[:MAX_TOOL_RESULT_CHARS]


def _assistant_message(c: _Completion) -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": c.text or None,
        "tool_calls": [
            {
                "id": call.id,
                "type": "function",
                "function": {"name": call.name, "arguments": call.arguments or "{}"},
            }
            for call in c.tool_calls
        ],
    }


def _loads(raw: str) -> dict[str, Any]:
    try:
        value = json.loads(raw or "{}")
    except json.JSONDecodeError:
        return {}
    return value if isinstance(value, dict) else {}


def _reason(exc: httpx.HTTPError) -> str:
    if isinstance(exc, httpx.HTTPStatusError):
        return f"HTTP {exc.response.status_code}"
    return type(exc).__name__
