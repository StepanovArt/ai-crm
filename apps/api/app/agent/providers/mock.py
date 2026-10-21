"""Mock LLM provider: an intent router over scenarios that query and change real data.

Only the "reasoning" is scripted. Every number, name and date comes from tool calls, and
plans execute through the same tools a real model would use.
"""

import random
import re
from collections.abc import Callable
from dataclasses import dataclass

from app.agent.context import PageContext
from app.agent.providers.base import (
    ConversationState,
    ProviderRun,
    StoredPlan,
    ThinkingStep,
    ToolCallStep,
    ToolOutcome,
    UIActionStep,
)
from app.agent.scenarios import (
    briefing,
    create_task,
    draft_email,
    fallback,
    hot_leads,
    move_deal,
    pipeline_report,
    stale_followups,
    summarize,
)
from app.agent.scenarios.common import ScenarioGen
from app.agent.scenarios.kit import Kit, Pacer, ui_pause
from app.agent.tools import ToolRegistry

Scenario = Callable[[Kit], ScenarioGen]


@dataclass(frozen=True)
class Rule:
    name: str
    pattern: re.Pattern[str]
    scenario: Scenario
    needs_record: bool = False


def _re(pattern: str) -> re.Pattern[str]:
    return re.compile(pattern, re.IGNORECASE)


# Ordered: the first matching rule wins.
RULES: tuple[Rule, ...] = (
    Rule(
        "draft_email",
        _re(r"\b(draft|write|compose|prepare)\b.*\b(e-?mail|message|reply)\b|\bdraft\b"),
        draft_email.run,
    ),
    Rule(
        "stale_followups",
        _re(
            r"\b(stale|quiet|stuck|cold|neglected|inactive|no activity)\b.*\b(follow[- ]?ups?|tasks?|remind)|\bfollow[- ]?ups?\b.*\b(stale|quiet|stuck)\b"
        ),
        stale_followups.run,
    ),
    Rule(
        "move_deal",
        _re(r"^\s*(please\s+)?(move|push|advance|shift|put|drag)\b.+\b(to|into)\b"),
        move_deal.run,
    ),
    Rule(
        "summarize",
        _re(r"\b(summari[sz]e|summary|recap|tl;?dr|catch me up|what('s| is| has) (been )?happen)"),
        summarize.run,
    ),
    Rule(
        "hot_leads",
        _re(
            r"\b(hot|warmest|best|top)\b.*\b(leads?|contacts?|prospects?|people)\b|who should i (call|contact|reach)"
        ),
        hot_leads.run,
    ),
    Rule(
        "briefing",
        _re(
            r"\b(my plate|on my plate|today|agenda|briefing|brief me|what should i (do|focus)|priorit)"
        ),
        briefing.run,
    ),
    Rule(
        "pipeline_report",
        _re(
            r"\b(pipeline|forecast|revenue|quota|how('s| is| are) (we|things|it)|this month|numbers|stats)\b"
        ),
        pipeline_report.run,
    ),
    Rule("stale_list", _re(r"\b(stale|stuck|quiet|neglected)\b"), stale_followups.run),
    Rule(
        "create_task",
        _re(r"\b(remind me|create (a )?task|add (a )?task|make (a )?task|todo)\b"),
        create_task.run,
    ),
)


def route(message: str, ctx: PageContext) -> Rule | None:
    text = message.strip()
    for rule in RULES:
        if rule.pattern.search(text):
            return rule
    if ctx.record_type and re.search(r"\b(this|it)\b", text, re.IGNORECASE):
        return next(r for r in RULES if r.name == "summarize")
    return None


class MockProvider:
    def __init__(self, delay_scale: float = 1.0, seed: int | None = None) -> None:
        self.delay_scale = delay_scale
        self.seed = seed

    def _pacer(self) -> Pacer:
        return Pacer(self.delay_scale, random.Random(self.seed))

    async def run(
        self, conv: ConversationState, ctx: PageContext, tools: ToolRegistry
    ) -> ProviderRun:
        rule = route(conv.message, ctx)
        kit = Kit(conv=conv, ctx=ctx, tools=tools, pacer=self._pacer())
        scenario = rule.scenario if rule else fallback.run
        outcome: ToolOutcome | None = None
        inner = scenario(kit)
        while True:
            try:
                step = await inner.asend(outcome)
            except StopAsyncIteration:
                return
            outcome = yield step

    async def execute_plan(
        self, plan: StoredPlan, ctx: PageContext, tools: ToolRegistry
    ) -> ProviderRun:
        """Generic executor: prelude → (before, tool, after) per step → finale → summary."""
        pacer = self._pacer()
        payload = plan.payload
        yield ThinkingStep(str(payload.get("thinking") or "Working on it"))
        await pacer.pause(300, 700)
        for action in payload.get("prelude", []):
            yield UIActionStep(action)
            await pacer.pause(*ui_pause(action))
        ok = fail = 0
        for step in payload.get("steps", []):
            for action in step.get("before", []):
                yield UIActionStep(action)
                await pacer.pause(*ui_pause(action))
            outcome = yield ToolCallStep(step["tool"], step["args"], step.get("label"))
            await pacer.pause(150, 300)
            if outcome is not None and outcome.ok:
                ok += 1
                for action in step.get("after", []):
                    yield UIActionStep(action)
                    await pacer.pause(*ui_pause(action))
            else:
                fail += 1
        for action in payload.get("finale", []):
            if fail and action.get("kind") == "toast":
                continue
            yield UIActionStep(action)
            await pacer.pause(*ui_pause(action))
        template = str(payload.get("summary") if fail == 0 else payload.get("failure"))
        kit = Kit(
            conv=ConversationState(plan.plan_id, "", [], "", {}),
            ctx=ctx,
            tools=tools,
            pacer=pacer,
        )
        text = template.replace("{ok}", str(ok)).replace("{fail}", str(fail))
        async for s in kit.say(text):
            yield s
