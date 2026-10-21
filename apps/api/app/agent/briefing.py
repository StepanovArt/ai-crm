"""Daily briefing: shared by scenario S1, `GET /agent/briefing` and its streamed variant."""

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.agent.timeutil import greeting, money
from app.models.base import utcnow


class BriefingItem(BaseModel):
    type: Literal["task", "contact", "deal"]
    id: str
    title: str
    subtitle: str | None = None
    badge: str | None = None
    tone: Literal["danger", "warning", "positive", "neutral"] = "neutral"
    href: str


class Briefing(BaseModel):
    greeting: str
    headline: str
    markdown: str
    items: list[BriefingItem]
    generated_at: datetime


def _plural(n: int, one: str, many: str | None = None) -> str:
    return f"{n} {one if n == 1 else many or one + 's'}"


def compose_briefing(
    *,
    first_name: str,
    tz: str | None,
    terms: dict[str, str],
    tasks_today: list[dict[str, Any]],
    tasks_overdue: list[dict[str, Any]],
    hot: list[dict[str, Any]],
    hot_total: int,
    stale: list[dict[str, Any]],
    stale_total: int,
) -> Briefing:
    hello = f"{greeting(tz)}, {first_name}."
    deals_word = terms.get("deals", "Deals").lower()
    deal_word = terms.get("deal", "Deal").lower()
    lines: list[str] = []

    n_today, n_overdue = len(tasks_today), len(tasks_overdue)
    pending = tasks_overdue + tasks_today
    first_task = pending[0] if pending else None
    if n_today or n_overdue:
        parts = []
        if n_today:
            parts.append(f"**{_plural(n_today, 'task')} due today**")
        if n_overdue:
            parts.append(f"{n_overdue} overdue" if n_today else f"**{n_overdue} overdue**")
        start = f" — start with *{first_task['title']}*" if first_task else ""
        lines.append(f"- {' and '.join(parts)}{start}.")
    else:
        lines.append("- **No tasks due today** — a good day to get ahead.")

    top_lead = hot[0] if hot else None
    if top_lead:
        reason = (top_lead.get("reasons") or [{}])[0].get("detail", "")
        company = f" ({top_lead['company']['name']})" if top_lead.get("company") else ""
        why = f" — {reason[0].lower() + reason[1:]}" if reason else ""
        lines.append(
            f"- **{_plural(hot_total, 'hot lead')}** worth your time. "
            f"{top_lead['title']}{company} scores {top_lead['score']}{why}."
        )
    else:
        lines.append(
            "- **No hot leads** right now — replies and booked meetings will surface people here."
        )

    top_stale = stale[0] if stale else None
    if top_stale:
        quiet = top_stale.get("days_quiet")
        verb = "is" if stale_total == 1 else "are"
        lines.append(
            f"- **{_plural(stale_total, deal_word, deals_word)} {verb} going stale** — "
            f"{top_stale['title']} has been quiet for {quiet} days "
            f"({money(top_stale['value'], top_stale.get('currency', 'USD'))} at stake)."
        )
    else:
        lines.append(f"- **No stale {deals_word}** — every open {deal_word} was touched this week.")

    if top_lead and first_task:
        close = (
            f"I'd start with {top_lead['title'].split()[0]}, then clear *{first_task['title']}*."
        )
    elif top_stale:
        close = f"I'd start by re-engaging {top_stale['title']}."
    else:
        close = "Nothing urgent — maybe a good moment to prospect."

    headline = f"{_plural(n_today + n_overdue, 'task')} · {_plural(hot_total, 'hot lead')} · {stale_total} stale"
    markdown = f"{hello} Here's what matters today:\n\n" + "\n".join(lines) + f"\n\n{close}"

    items: list[BriefingItem] = []
    for t in (tasks_overdue + tasks_today)[:2]:
        overdue = t in tasks_overdue
        items.append(
            BriefingItem(
                type="task",
                id=t["id"],
                title=t["title"],
                subtitle=t.get("subtitle"),
                badge="Overdue" if overdue else "Today",
                tone="danger" if overdue else "warning",
                href=t["href"],
            )
        )
    for c in hot[:2]:
        reason = (c.get("reasons") or [{}])[0].get("label")
        items.append(
            BriefingItem(
                type="contact",
                id=c["id"],
                title=c["title"],
                subtitle=reason or c.get("subtitle"),
                badge=f"Score {c['score']}",
                tone="positive",
                href=c["href"],
            )
        )
    for d in stale[:2]:
        items.append(
            BriefingItem(
                type="deal",
                id=d["id"],
                title=d["title"],
                subtitle=d.get("subtitle"),
                badge=f"{d.get('days_quiet')}d quiet",
                tone="warning",
                href=d["href"],
            )
        )
    return Briefing(
        greeting=hello, headline=headline, markdown=markdown, items=items, generated_at=utcnow()
    )


def briefing_card(b: Briefing) -> dict[str, Any]:
    from app.agent.cards import RecordItem, RecordsCard

    card = RecordsCard(
        title="Start here", items=[RecordItem.model_validate(i.model_dump()) for i in b.items]
    )
    return card.model_dump(mode="json")
