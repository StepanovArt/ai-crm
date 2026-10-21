"""Explainable lead scoring.

score = clamp(sum(w_k * x_k), 0, 100) where x_k in {0, 1} is whether signal k fires.
"""

import re
import uuid
from collections import defaultdict
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import or_, select

from app.models import Activity, Contact, Deal, Stage
from app.models.base import utcnow
from app.services.context import Ctx
from app.services.scoping import get_scoped, scoped

# Activity types that represent real interaction (drive "last activity" and staleness).
INTERACTION_TYPES: frozenset[str] = frozenset(
    {"email_sent", "email_received", "call", "meeting", "note", "stage_changed"}
)


@dataclass(frozen=True)
class Signal:
    key: str
    label: str
    weight: int


SIGNALS: tuple[Signal, ...] = (
    Signal("replied_recently", "Replied recently", 30),
    Signal("meeting_scheduled", "Meeting scheduled", 25),
    Signal("opened_multiple", "Opened emails multiple times", 10),
    Signal("deal_open", "Has an open deal", 15),
    Signal("title_is_decision_maker", "Decision maker", 10),
    Signal("stale_14d", "No touch in 14+ days", -20),
)

REPLY_WINDOW = timedelta(days=14)
MEETING_WINDOW = timedelta(days=14)
OPENS_WINDOW = timedelta(days=30)
STALE_WINDOW = timedelta(days=14)

_DECISION_MAKER = re.compile(
    r"\b(ceo|cto|cfo|coo|cmo|cro|cio|chief|founder|co-founder|owner|president|vp|"
    r"vice president|head|director|partner|principal|managing)\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class ActivityFact:
    type: str
    occurred_at: datetime
    payload: dict[str, Any]


@dataclass(frozen=True)
class SignalResult:
    key: str
    label: str
    weight: int
    active: bool
    detail: str


@dataclass(frozen=True)
class ScoreBreakdown:
    score: int
    signals: list[SignalResult]

    @property
    def reasons(self) -> list[SignalResult]:
        """Active signals, strongest first — used for reason chips."""
        return sorted((s for s in self.signals if s.active), key=lambda s: -abs(s.weight))


def is_decision_maker(title: str | None) -> bool:
    return bool(title and _DECISION_MAKER.search(title))


def _parse_dt(raw: object) -> datetime | None:
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None
    return None


def compute_score(
    *,
    title: str | None,
    activities: Sequence[ActivityFact],
    has_open_deal: bool,
    now: datetime | None = None,
) -> ScoreBreakdown:
    now = now or utcnow()
    replies = [
        a for a in activities if a.type == "email_received" and a.occurred_at >= now - REPLY_WINDOW
    ]
    meetings = []
    for a in activities:
        if a.type != "meeting":
            continue
        scheduled_for = _parse_dt(a.payload.get("scheduled_for"))
        if (
            scheduled_for is not None and scheduled_for >= now
        ) or a.occurred_at >= now - MEETING_WINDOW:
            meetings.append(a)
    opens = [
        a
        for a in activities
        if a.type == "email_sent"
        and a.occurred_at >= now - OPENS_WINDOW
        and int(a.payload.get("opens", 0) or 0) >= 2
    ]
    touches = [a.occurred_at for a in activities if a.type in INTERACTION_TYPES]
    last_touch = max(touches) if touches else None
    stale = last_touch is None or last_touch < now - STALE_WINDOW

    details: dict[str, tuple[bool, str]] = {
        "replied_recently": (
            bool(replies),
            f"Replied {_ago(max(a.occurred_at for a in replies), now)}"
            if replies
            else "No reply in 14 days",
        ),
        "meeting_scheduled": (
            bool(meetings),
            "Meeting on the calendar" if meetings else "No upcoming or recent meeting",
        ),
        "opened_multiple": (
            bool(opens),
            f"Opened an email {max(int(a.payload.get('opens', 0) or 0) for a in opens)} times"
            if opens
            else "No repeated opens",
        ),
        "deal_open": (
            has_open_deal,
            "Primary contact on an open deal" if has_open_deal else "No open deal",
        ),
        "title_is_decision_maker": (
            is_decision_maker(title),
            f"Title: {title}" if title else "No title",
        ),
        "stale_14d": (
            stale,
            f"Last touch {_ago(last_touch, now)}" if last_touch else "Never contacted",
        ),
    }
    results = [SignalResult(s.key, s.label, s.weight, *details[s.key]) for s in SIGNALS]
    total = sum(r.weight for r in results if r.active)
    return ScoreBreakdown(score=max(0, min(100, total)), signals=results)


def _ago(when: datetime | None, now: datetime) -> str:
    if when is None:
        return "never"
    days = (now - when).days
    if days <= 0:
        return "today"
    if days == 1:
        return "yesterday"
    return f"{days} days ago"


async def _facts_by_contact(
    ctx: Ctx, contact_ids: Iterable[uuid.UUID]
) -> dict[uuid.UUID, list[ActivityFact]]:
    ids = list(contact_ids)
    facts: dict[uuid.UUID, list[ActivityFact]] = defaultdict(list)
    if not ids:
        return facts
    since = utcnow() - timedelta(days=90)
    deal_rows = (
        await ctx.session.execute(
            select(Deal.id, Deal.primary_contact_id).where(
                Deal.workspace_id == ctx.workspace_id, Deal.primary_contact_id.in_(ids)
            )
        )
    ).all()
    deal_to_contact = {d: c for d, c in deal_rows if c is not None}
    stmt = scoped(Activity, ctx.workspace_id).where(
        Activity.occurred_at >= since,
        or_(
            (Activity.related_type == "contact") & Activity.related_id.in_(ids),
            (Activity.related_type == "deal") & Activity.related_id.in_(list(deal_to_contact)),
        ),
    )
    for a in (await ctx.session.scalars(stmt)).all():
        owner = a.related_id if a.related_type == "contact" else deal_to_contact.get(a.related_id)
        if owner is not None:
            facts[owner].append(ActivityFact(a.type, a.occurred_at, a.payload or {}))
    return facts


async def _open_deal_contacts(ctx: Ctx, contact_ids: Iterable[uuid.UUID]) -> set[uuid.UUID]:
    rows = await ctx.session.scalars(
        select(Deal.primary_contact_id)
        .join(Stage, Stage.id == Deal.stage_id)
        .where(
            Deal.workspace_id == ctx.workspace_id,
            Deal.primary_contact_id.in_(list(contact_ids)),
            Stage.kind == "open",
        )
    )
    return {c for c in rows.all() if c is not None}


async def score_contacts(
    ctx: Ctx, contacts: Sequence[Contact], *, persist: bool = True
) -> dict[uuid.UUID, ScoreBreakdown]:
    ids = [c.id for c in contacts]
    facts = await _facts_by_contact(ctx, ids)
    open_deal = await _open_deal_contacts(ctx, ids)
    now = utcnow()
    out: dict[uuid.UUID, ScoreBreakdown] = {}
    for contact in contacts:
        breakdown = compute_score(
            title=contact.title,
            activities=facts.get(contact.id, []),
            has_open_deal=contact.id in open_deal,
            now=now,
        )
        out[contact.id] = breakdown
        if persist and contact.score != breakdown.score:
            contact.score = breakdown.score
    if persist:
        await ctx.session.flush()
    return out


async def score_contact(ctx: Ctx, contact_id: uuid.UUID) -> ScoreBreakdown:
    contact = await get_scoped(ctx, Contact, contact_id, "Contact")
    return (await score_contacts(ctx, [contact]))[contact.id]


async def recompute_all(ctx: Ctx) -> int:
    contacts = list((await ctx.session.scalars(scoped(Contact, ctx.workspace_id))).all())
    await score_contacts(ctx, contacts)
    return len(contacts)
