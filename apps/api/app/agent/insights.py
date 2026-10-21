"""Deterministic record insights: summary, key facts and a suggested next step.

Used by the `summarize_record` tool, `/agent/insights` and the email drafter. Everything
is derived from real timeline data; only the phrasing is templated.
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel

from app.agent.timeutil import ago, fmt_day, money
from app.models import Activity
from app.models.base import utcnow
from app.schemas.records import ContactFilter, ContactOut, DealFilter, DealOut
from app.schemas.work import TaskFilter
from app.services import companies as companies_service
from app.services import contacts as contacts_service
from app.services import deals as deals_service
from app.services import tasks as tasks_service
from app.services.activities import list_timeline
from app.services.context import Ctx
from app.services.listing import ListParams
from app.services.scoring import score_contact

RecordType = Literal["company", "contact", "deal"]


class NextStep(BaseModel):
    title: str
    reason: str
    due_in_days: int
    related_type: RecordType
    related_id: uuid.UUID


class Insight(BaseModel):
    record_type: RecordType
    record_id: uuid.UUID
    title: str
    headline: str
    tone: Literal["positive", "neutral", "warning"]
    summary: str
    bullets: list[str]
    next_step: NextStep | None
    generated_at: datetime


@dataclass
class _Engagement:
    last: Activity | None = None
    last_reply: Activity | None = None
    upcoming_meeting: Activity | None = None
    counts: dict[str, int] = field(default_factory=dict)


def _parse(raw: Any) -> datetime | None:
    if isinstance(raw, str):
        try:
            return datetime.fromisoformat(raw)
        except ValueError:
            return None
    return None


def _engagement(activities: list[Activity]) -> _Engagement:
    now = utcnow()
    eng = _Engagement()
    touch_types = {"email_sent", "email_received", "call", "meeting", "note"}
    for a in activities:  # newest first
        if eng.last is None and a.type in touch_types:
            eng.last = a
        if eng.last_reply is None and a.type == "email_received":
            eng.last_reply = a
        scheduled = _parse((a.payload or {}).get("scheduled_for"))
        if a.type == "meeting" and scheduled and scheduled > now and eng.upcoming_meeting is None:
            eng.upcoming_meeting = a
        if (now - a.occurred_at).days <= 30:
            eng.counts[a.type] = eng.counts.get(a.type, 0) + 1
    return eng


def plural(n: int, word: str, many: str | None = None) -> str:
    return f"{n} {word if n == 1 else many or word + 's'}"


def _describe(a: Activity) -> str:
    p = a.payload or {}
    when = ago(a.occurred_at)
    if a.type == "email_received":
        return f"Replied “{p.get('subject', 'email')}” ({when})"
    if a.type == "email_sent":
        return f"Emailed “{p.get('subject', 'email')}” ({when})"
    if a.type == "call":
        return f"Call: {p.get('summary', 'check-in')} ({when})"
    if a.type == "meeting":
        verb = "Booked" if p.get("status") == "scheduled" else "Met"
        return f"{verb} “{p.get('title', 'meeting')}” ({when})"
    if a.type == "note":
        return f"Note: {str(p.get('excerpt', ''))[:90]} ({when})"
    return f"{a.type.replace('_', ' ').capitalize()} ({when})"


def _meeting_line(a: Activity) -> str:
    p = a.payload or {}
    when = _parse(p.get("scheduled_for"))
    day = f" · {fmt_day(when)}" if when else ""
    return f"Meeting booked: {p.get('title', 'meeting')}{day}"


def _days(d: datetime | None) -> int | None:
    return None if d is None else max(0, (utcnow() - d).days)


async def _primary_open_deal(ctx: Ctx, contact_id: uuid.UUID) -> DealOut | None:
    deals = await deals_service.list_all_deals(
        ctx, DealFilter(primary_contact_id=contact_id, status="open")
    )
    return max(deals, key=lambda d: d.value) if deals else None


def _stage_next_step(deal: DealOut, contact_first: str) -> tuple[str, str]:
    custom_step = (deal.custom or {}).get("next_step")
    if isinstance(custom_step, str) and custom_step.strip():
        return (
            custom_step.strip(),
            f"Next step recorded on the {deal.stage.name if deal.stage else 'deal'}",
        )
    prob = deal.stage.probability if deal.stage else 0
    who = contact_first or "the buyer"
    if prob < 25:
        return (
            f"Qualify needs, budget and timeline with {who}",
            "Early stage — confirm fit before investing more time",
        )
    if prob < 50:
        return f"Book a walkthrough with {who}", "Qualified — show the value in a live session"
    if prob < 70:
        return f"Send a tailored proposal to {who}", "Interest is confirmed — put terms in writing"
    if prob < 90:
        return (
            f"Follow up on the proposal with {who}",
            "Late stage — keep momentum toward a decision",
        )
    return f"Confirm final terms and signature with {who}", "Closing — remove the last blockers"


async def contact_insight(ctx: Ctx, contact_id: uuid.UUID) -> Insight:
    contact: ContactOut = await contacts_service.get_contact(ctx, contact_id)
    activities = await list_timeline(ctx, "contact", contact_id, limit=60)
    eng = _engagement(activities)
    breakdown = await score_contact(ctx, contact_id)
    deal = await _primary_open_deal(ctx, contact_id)
    first = contact.first_name
    quiet = _days(eng.last.occurred_at) if eng.last else None

    bullets: list[str] = []
    if eng.last_reply is not None:
        bullets.append(_describe(eng.last_reply))
    if eng.upcoming_meeting is not None:
        bullets.append(_meeting_line(eng.upcoming_meeting))
    if deal is not None:
        bullets.append(
            f"Open deal: {deal.name} · {deal.stage.name if deal.stage else ''} · {money(deal.value, deal.currency)}"
        )
    if eng.last is not None and eng.last is not eng.last_reply:
        bullets.append(f"Last touch: {_describe(eng.last)}")
    reasons = [s.label.lower() for s in breakdown.reasons if s.weight > 0][:3]
    if reasons:
        bullets.append(f"Score {breakdown.score} — " + ", ".join(reasons))
    if not bullets:
        bullets.append(f"Score {breakdown.score} — no engagement signals yet")

    if eng.last is None:
        headline, tone = "New — no conversations yet", "neutral"
    elif quiet is not None and quiet >= 14:
        headline, tone = f"Gone quiet — no touch in {quiet} days", "warning"
    elif eng.last_reply is not None and (_days(eng.last_reply.occurred_at) or 0) <= 7:
        headline, tone = f"Engaged — replied {ago(eng.last_reply.occurred_at)}", "positive"
    else:
        headline, tone = f"Active — last touch {ago(eng.last.occurred_at)}", "neutral"

    company = f" at {contact.company.name}" if contact.company else ""
    role = f"{contact.title}{company}" if contact.title else company.strip() or "a contact"
    sent, replies = eng.counts.get("email_sent", 0), eng.counts.get("email_received", 0)
    calls, meetings = eng.counts.get("call", 0), eng.counts.get("meeting", 0)
    engagement = (
        "In the last 30 days: "
        + ", ".join(
            [
                plural(sent, "email") + " sent",
                plural(replies, "reply", "replies"),
                plural(calls, "call"),
            ]
        )
        + f" and {plural(meetings, 'meeting')}."
        if any((sent, replies, calls, meetings))
        else "No conversations in the last 30 days."
    )
    deal_line = (
        f" They're the main contact on {deal.name}, now in {deal.stage.name if deal.stage else 'progress'}."
        if deal
        else ""
    )
    summary = f"{contact.full_name} is {role}. {engagement}{deal_line}"

    if eng.upcoming_meeting is not None:
        when = _parse((eng.upcoming_meeting.payload or {}).get("scheduled_for"))
        days_until = max(0, (when - utcnow()).days) if when else 1
        step = NextStep(
            title=f"Prepare for {(eng.upcoming_meeting.payload or {}).get('title', 'the meeting')} with {first}",
            reason="A meeting is on the calendar",
            due_in_days=max(0, days_until - 1),
            related_type="contact",
            related_id=contact.id,
        )
    elif eng.last_reply is not None and (_days(eng.last_reply.occurred_at) or 0) <= 7:
        step = NextStep(
            title=f"Book a call with {first}",
            reason=f"{first} replied {ago(eng.last_reply.occurred_at)} — strike while it's warm",
            due_in_days=1,
            related_type="contact",
            related_id=contact.id,
        )
    elif deal is not None and (
        deal.last_activity_at is None or (_days(deal.last_activity_at) or 0) >= 7
    ):
        step = NextStep(
            title=f"Re-engage {first} on {deal.name}",
            reason=f"No activity on the deal for {_days(deal.last_activity_at) or 'many'} days",
            due_in_days=1,
            related_type="contact",
            related_id=contact.id,
        )
    elif deal is not None:
        title, reason = _stage_next_step(deal, first)
        step = NextStep(
            title=title, reason=reason, due_in_days=2, related_type="contact", related_id=contact.id
        )
    elif eng.last is None:
        step = NextStep(
            title=f"Send an intro email to {first}",
            reason="No outreach yet",
            due_in_days=1,
            related_type="contact",
            related_id=contact.id,
        )
    else:
        step = NextStep(
            title=f"Check in with {first}",
            reason=f"Last touch {ago(eng.last.occurred_at)}",
            due_in_days=2 if (quiet or 0) >= 14 else 3,
            related_type="contact",
            related_id=contact.id,
        )
    return Insight(
        record_type="contact",
        record_id=contact.id,
        title=contact.full_name,
        headline=headline,
        tone=tone,
        summary=summary,
        bullets=bullets[:5],
        next_step=step,
        generated_at=utcnow(),
    )


def _stage_age(days: int) -> str:
    if days <= 0:
        return "since today"
    return f"for {plural(days, 'day')}"


async def deal_insight(ctx: Ctx, deal_id: uuid.UUID) -> Insight:
    deal = await deals_service.get_deal(ctx, deal_id)
    activities = await list_timeline(ctx, "deal", deal_id, limit=60)
    eng = _engagement(activities)
    tasks, _ = await tasks_service.list_tasks(
        ctx, ListParams(limit=20), TaskFilter(related_type="deal", related_id=deal_id, done=False)
    )
    stage = deal.stage
    kind = stage.kind if stage else "open"
    quiet = _days(deal.last_activity_at)
    in_stage = _days(deal.stage_entered_at)
    first = deal.primary_contact.full_name.split()[0] if deal.primary_contact else ""
    weighted = float(deal.value) * (stage.probability if stage else 0) / 100

    bullets = [
        f"Stage: {stage.name if stage else '—'} ({stage.probability if stage else 0}%)"
        + (f" {_stage_age(in_stage)}" if in_stage is not None else ""),
        f"Value: {money(deal.value, deal.currency)} · weighted {money(weighted, deal.currency)}",
    ]
    if eng.last is not None:
        bullets.append(f"Last touch: {_describe(eng.last)}")
    if deal.expected_close and kind == "open":
        days_to_close = (deal.expected_close - utcnow().date()).days
        when = (
            f"{-days_to_close} days overdue"
            if days_to_close < 0
            else "today"
            if days_to_close == 0
            else f"in {days_to_close} days"
        )
        bullets.append(f"Expected close: {fmt_day(deal.expected_close)} ({when})")
    if tasks:
        bullets.append(f"Open tasks: {len(tasks)} — next: {tasks[0].title}")

    if kind == "won":
        headline, tone = "Won — nice work", "positive"
    elif kind == "lost":
        headline, tone = "Lost", "neutral"
    elif quiet is not None and quiet >= 7:
        headline, tone = f"At risk — no activity in {quiet} days", "warning"
    elif deal.expected_close and (deal.expected_close - utcnow().date()).days <= 14:
        headline, tone = f"Closing soon — expected {fmt_day(deal.expected_close)}", "positive"
    else:
        headline, tone = (
            f"On track — in {stage.name if stage else 'pipeline'} {_stage_age(in_stage or 0)}",
            "positive",
        )

    who = f" with {deal.primary_contact.full_name}" if deal.primary_contact else ""
    company = f" for {deal.company.name}" if deal.company else ""
    engagement = (
        f"The last touch was {ago(deal.last_activity_at)}."
        if deal.last_activity_at
        else "There's no activity logged yet."
    )
    reply = (
        f" {first} last replied {ago(eng.last_reply.occurred_at)}."
        if eng.last_reply and first
        else ""
    )
    summary = (
        f"{money(deal.value, deal.currency)} opportunity{company}{who}, currently in "
        f"{stage.name if stage else 'the pipeline'}. {engagement}{reply}"
    )

    step: NextStep | None = None
    if kind == "open":
        if quiet is not None and quiet >= 7:
            title = f"Re-engage {first or 'the buyer'} — check the deal is still a priority"
            reason = f"No activity for {quiet} days"
            due = 1
        else:
            title, reason = _stage_next_step(deal, first)
            due = 2
        if deal.expected_close and deal.expected_close < utcnow().date():
            title, reason, due = (
                "Update the expected close date",
                "The expected close date has passed",
                0,
            )
        step = NextStep(
            title=title, reason=reason, due_in_days=due, related_type="deal", related_id=deal.id
        )
    return Insight(
        record_type="deal",
        record_id=deal.id,
        title=deal.name,
        headline=headline,
        tone=tone,
        summary=summary,
        bullets=bullets[:5],
        next_step=step,
        generated_at=utcnow(),
    )


async def company_insight(ctx: Ctx, company_id: uuid.UUID) -> Insight:
    company = await companies_service.get_company(ctx, company_id)
    contacts, n_contacts = await contacts_service.list_contacts(
        ctx, ListParams(limit=50, sort="-score"), ContactFilter(company_id=company_id)
    )
    deals = await deals_service.list_all_deals(ctx, DealFilter(company_id=company_id))
    open_deals = [d for d in deals if d.stage and d.stage.kind == "open"]
    won = [d for d in deals if d.stage and d.stage.kind == "won"]
    champion = contacts[0] if contacts else None
    quiet = _days(company.last_activity_at)

    bullets = [
        f"{plural(n_contacts, 'contact')} · {plural(len(open_deals), 'open deal')} worth {money(company.open_deals_value)}"
    ]
    if champion is not None:
        bullets.append(
            f"Most engaged: {champion.full_name} ({champion.title or 'contact'}) · score {champion.score}"
        )
    if open_deals:
        top = max(open_deals, key=lambda d: d.value)
        bullets.append(
            f"Biggest open deal: {top.name} · {top.stage.name if top.stage else ''} · {money(top.value, top.currency)}"
        )
    if won:
        bullets.append(
            f"Won so far: {len(won)} deal{'s' if len(won) != 1 else ''} · {money(sum(float(d.value) for d in won))}"
        )
    if company.last_activity_at:
        bullets.append(f"Last activity {ago(company.last_activity_at)}")

    if quiet is not None and quiet >= 14:
        headline, tone = f"Cooling off — no activity in {quiet} days", "warning"
    elif open_deals:
        headline, tone = (
            f"{len(open_deals)} open deal{'s' if len(open_deals) != 1 else ''} in play",
            "positive",
        )
    else:
        headline, tone = "No open deals right now", "neutral"
    summary = (
        f"{company.name}{f' ({company.industry})' if company.industry else ''} has {n_contacts} known "
        f"contact{'s' if n_contacts != 1 else ''}"
        + (f"; {champion.full_name} is the most engaged." if champion else ".")
    )

    step: NextStep | None
    if open_deals:
        top = max(open_deals, key=lambda d: d.value)
        first = top.primary_contact.full_name.split()[0] if top.primary_contact else ""
        title, reason = _stage_next_step(top, first)
        step = NextStep(
            title=f"{title} ({top.name})",
            reason=reason,
            due_in_days=2,
            related_type="company",
            related_id=company.id,
        )
    elif champion is not None:
        step = NextStep(
            title=f"Explore a new opportunity with {champion.first_name}",
            reason="Engaged contact but no open deal",
            due_in_days=3,
            related_type="company",
            related_id=company.id,
        )
    else:
        step = NextStep(
            title=f"Find a first contact at {company.name}",
            reason="No contacts yet",
            due_in_days=3,
            related_type="company",
            related_id=company.id,
        )
    return Insight(
        record_type="company",
        record_id=company.id,
        title=company.name,
        headline=headline,
        tone=tone,
        summary=summary,
        bullets=bullets[:5],
        next_step=step,
        generated_at=utcnow(),
    )


async def build_insight(ctx: Ctx, record_type: RecordType, record_id: uuid.UUID) -> Insight:
    if record_type == "contact":
        return await contact_insight(ctx, record_id)
    if record_type == "deal":
        return await deal_insight(ctx, record_id)
    return await company_insight(ctx, record_id)
