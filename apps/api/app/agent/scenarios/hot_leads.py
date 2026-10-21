"""S7 — "Show me hot leads": filter contacts to score >= 70, navigate, highlight the top three."""

from typing import Any

from app.agent.cards import RecordItem, RecordsCard
from app.agent.providers.base import SuggestionsStep, ToolCallStep
from app.agent.scenarios.common import ScenarioGen, items, need
from app.agent.scenarios.kit import Kit
from app.services.scoring import HOT_SCORE


def _line(i: int, c: dict[str, Any]) -> str:
    company = (c.get("company") or {}).get("name")
    reasons = c.get("reasons") or []
    why = str(reasons[0]["detail"]).lower() if reasons else ""
    return f"{i}. **{c['title']}**{f' ({company})' if company else ''} — {c['score']}{f' · {why}' if why else ''}"


async def run(kit: Kit) -> ScenarioGen:
    async for s in kit.think("Ranking your leads"):
        yield s
    found = need(
        (
            yield ToolCallStep(
                "search_records",
                {"object_type": "contact", "score_min": HOT_SCORE, "sort": "-score", "limit": 10},
            )
        )
    )
    leads = items(found)
    total = int(found.data.get("total", 0))
    if not leads:
        async for s in kit.say(
            f"No contacts score {HOT_SCORE}+ right now. Replies and booked meetings push people up — "
            "want me to find quiet deals instead?"
        ):
            yield s
        yield SuggestionsStep(["Find stale deals and create follow-ups"])
        return

    async for s in kit.say(
        f"You have **{total} hot lead{'s' if total != 1 else ''}** (score {HOT_SCORE}+). Pulling them up…"
    ):
        yield s
    async for s in kit.ui({"kind": "navigate", "href": "/contacts"}):
        yield s
    async for s in kit.ui(
        {"kind": "apply_filter", "view": "contacts", "filter": {"score_min": HOT_SCORE}}
    ):
        yield s
    for lead in leads[:3]:
        async for s in kit.ui(
            {"kind": "highlight", "target": f"contact-row-{lead['id']}", "duration_ms": 800}
        ):
            yield s

    top = "\n".join(_line(i + 1, c) for i, c in enumerate(leads[:3]))
    async for s in kit.say(
        f"\n\nThe top three:\n\n{top}\n\nI'd reach out to {str(leads[0]['title']).split()[0]} first."
    ):
        yield s
    card = RecordsCard(
        title="Hot leads",
        items=[
            RecordItem(
                type="contact",
                id=c["id"],
                title=c["title"],
                subtitle=c.get("subtitle"),
                badge=f"Score {c['score']}",
                tone="positive",
                href=c["href"],
            )
            for c in leads[:5]
        ],
    )
    async for s in kit.card("records", card.model_dump(mode="json")):
        yield s
    yield SuggestionsStep(
        [f"Draft a follow-up email to {leads[0]['title']}", "What's on my plate today?"]
    )
