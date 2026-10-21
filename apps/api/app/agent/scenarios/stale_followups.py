"""S2 — "Find stale deals and create follow-ups": search → plan → (approve) highlight + create tasks."""

from typing import Any

from app.agent.providers.base import PlannedStep, PlanStep, SuggestionsStep, ToolCallStep
from app.agent.scenarios.common import INVALIDATE_ALL, ScenarioGen, first_word, items, need
from app.agent.scenarios.kit import Kit
from app.agent.timeutil import money

STALE_DAYS = 7
MAX_DEALS = 8


def _task_title(deal: dict[str, Any]) -> str:
    contact = first_word((deal.get("contact") or {}).get("name"))
    name = deal["title"]
    return f"Follow up with {contact} on {name}" if contact else f"Re-engage {name}"


async def run(kit: Kit) -> ScenarioGen:
    deals_word = kit.term("deals").lower()
    async for s in kit.think("Scanning the pipeline for quiet deals"):
        yield s
    found = need(
        (
            yield ToolCallStep(
                "search_records",
                {
                    "object_type": "deal",
                    "stale_days": STALE_DAYS,
                    "status": "open",
                    "sort": "last_activity_at",
                    "limit": MAX_DEALS,
                },
            )
        )
    )
    deals = items(found)
    if not deals:
        async for s in kit.say(
            f"Good news — every open {kit.term('deal').lower()} has had activity in the last {STALE_DAYS} days. Nothing to follow up on."
        ):
            yield s
        yield SuggestionsStep(["Show me hot leads", "What's on my plate today?"])
        return

    total_value = sum(float(d["value"]) for d in deals)
    currency = deals[0].get("currency", "USD")
    lines = "\n".join(
        f"- **{d['title']}** — {d['stage']['name'] if d.get('stage') else ''}, quiet for {d['days_quiet']} days"
        for d in deals
    )
    n = len(deals)
    intro = (
        f"I found **{n} {deals_word if n != 1 else kit.term('deal').lower()}** with no activity in over "
        f"{STALE_DAYS} days, worth {money(total_value, currency)} together:\n\n{lines}\n\n"
        f"I'll create a follow-up task for each one, due tomorrow at 10:00, and link it to the {kit.term('deal').lower()}."
    )
    async for s in kit.say(intro):
        yield s

    pipeline_id = deals[0]["pipeline_id"]
    steps = [
        PlannedStep(
            label=f"Follow-up task for {d['title']}",
            tool="create_task",
            args={
                "tasks": [
                    {
                        "title": _task_title(d),
                        "due_in_days": 1,
                        "related_type": "deal",
                        "related_id": d["id"],
                    }
                ]
            },
            before=[{"kind": "highlight", "target": f"deal-card-{d['id']}", "duration_ms": 1100}],
            after=[{"kind": "pulse", "target": f"deal-card-{d['id']}"}],
        )
        for d in deals
    ]
    yield PlanStep(
        title=f"Create follow-ups for {n} stale {deals_word if n != 1 else kit.term('deal').lower()}",
        steps=steps,
        prelude=[{"kind": "navigate", "href": f"/pipeline/{pipeline_id}"}],
        finale=[
            {"kind": "invalidate", "query_keys": INVALIDATE_ALL},
            {"kind": "toast", "text": f"Created {n} follow-up task{'s' if n != 1 else ''}"},
        ],
        thinking="Creating follow-up tasks",
        summary=(
            "Done — I created **{ok} follow-up task"
            + ("s" if n != 1 else "")
            + "**, due tomorrow at 10:00. "
            "You'll find them in Tasks and on each "
            + kit.term("deal").lower()
            + ". Use Undo if you'd rather handle it differently."
        ),
        failure="I created {ok} of the tasks; {fail} failed. Nothing else was changed.",
    )
    async for s in kit.say("Approve to run it — every change can be undone."):
        yield s
