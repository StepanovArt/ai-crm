"""S1 — "What's on my plate today?": tasks, hot leads, stale deals → briefing + records card."""

from app.agent.briefing import briefing_card, compose_briefing
from app.agent.providers.base import SuggestionsStep, ToolCallStep
from app.agent.scenarios.common import ScenarioGen, items, need
from app.agent.scenarios.kit import Kit


async def run(kit: Kit) -> ScenarioGen:
    async for s in kit.think("Looking at your day"):
        yield s
    overdue = need(
        (
            yield ToolCallStep(
                "search_records",
                {"object_type": "task", "task_bucket": "overdue", "mine": True, "sort": "due_at"},
            )
        )
    )
    today = need(
        (
            yield ToolCallStep(
                "search_records",
                {"object_type": "task", "task_bucket": "today", "mine": True, "sort": "due_at"},
            )
        )
    )
    async for s in kit.think("Checking who's warm"):
        yield s
    hot = need(
        (
            yield ToolCallStep(
                "search_records",
                {"object_type": "contact", "score_min": 70, "sort": "-score", "limit": 5},
            )
        )
    )
    stale = need(
        (
            yield ToolCallStep(
                "search_records",
                {"object_type": "deal", "stale_days": 7, "sort": "last_activity_at", "limit": 5},
            )
        )
    )
    briefing = compose_briefing(
        first_name=kit.first_name,
        tz=kit.ctx.timezone,
        terms=kit.conv.terminology,
        tasks_today=items(today),
        tasks_overdue=items(overdue),
        hot=items(hot),
        hot_total=int(hot.data.get("total", 0)),
        stale=items(stale),
        stale_total=int(stale.data.get("total", 0)),
    )
    async for s in kit.say(briefing.markdown):
        yield s
    if briefing.items:
        async for s in kit.card("records", briefing_card(briefing)):
            yield s
    yield SuggestionsStep(
        [
            "Find stale deals and create follow-ups",
            "Show me hot leads",
            "How's the pipeline this month?",
        ]
    )
