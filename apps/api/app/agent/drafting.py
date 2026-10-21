"""Follow-up email drafts composed from a contact's real history."""

import uuid

from pydantic import BaseModel

from app.agent.insights import _engagement, _parse, _primary_open_deal, _stage_next_step
from app.agent.timeutil import ago, next_business_days
from app.models import User
from app.services import contacts as contacts_service
from app.services.activities import list_timeline
from app.services.context import Ctx


class EmailDraft(BaseModel):
    to: str | None
    to_name: str
    subject: str
    body: str
    contact_id: uuid.UUID
    related_type: str
    related_id: uuid.UUID
    context_note: str


def _strip_re(subject: str) -> str:
    s = subject.strip()
    while s.lower().startswith("re:"):
        s = s[3:].strip()
    return s


async def draft_follow_up(ctx: Ctx, contact_id: uuid.UUID, tz: str | None = None) -> EmailDraft:
    contact = await contacts_service.get_contact(ctx, contact_id)
    activities = await list_timeline(ctx, "contact", contact_id, limit=40)
    eng = _engagement(activities)
    deal = await _primary_open_deal(ctx, contact_id)
    me = await ctx.session.get(User, ctx.user_id) if ctx.user_id else None
    sender = me.full_name.split()[0] if me else "Alex"
    first = contact.first_name
    company = contact.company.name if contact.company else "your team"
    day1, day2 = (d.strftime("%A") for d in next_business_days(2, tz))
    topic = deal.name.split(" — ")[-1].lower() if deal else "the project"

    last_subject = None
    for a in activities:
        subj = (a.payload or {}).get("subject")
        if isinstance(subj, str) and subj:
            last_subject = _strip_re(subj)
            break

    if eng.upcoming_meeting is not None:
        p = eng.upcoming_meeting.payload or {}
        when = _parse(p.get("scheduled_for"))
        title = str(p.get("title", "our meeting"))
        subject = f"Ahead of {title}"
        body = (
            f"Hi {first},\n\n"
            f"Looking forward to our {title.lower()} on {when.strftime('%A, %B %-d') if when else 'our call'}. "
            f"To make the most of the time, I'll come prepared with a short walkthrough of how {company} "
            f"could approach the {topic}, plus answers to the open questions from your last note.\n\n"
            "Is there anything specific you'd like us to cover, or anyone else who should join?\n\n"
            f"Best,\n{sender}"
        )
        note = f"References the {title} booked {ago(eng.upcoming_meeting.occurred_at)}."
    elif eng.last_reply is not None and (
        eng.last is eng.last_reply or (eng.last and eng.last.type != "email_sent")
    ):
        reply_subject = _strip_re(
            str((eng.last_reply.payload or {}).get("subject", last_subject or topic))
        )
        step = _stage_next_step(deal, first)[0] if deal else f"set up a short call with {first}"
        subject = f"Re: {reply_subject}"
        body = (
            f"Hi {first},\n\n"
            f"Thanks for getting back to me on {reply_subject.lower()}. "
            + (
                f"Based on where we are with the {topic}, I'd suggest we {step[0].lower() + step[1:]}. "
                if deal
                else "I'd love to understand your priorities for the next quarter. "
            )
            + f"Would {day1} or {day2} work for a 30-minute call?\n\n"
            f"Best,\n{sender}"
        )
        note = f"Replies to “{reply_subject}” ({ago(eng.last_reply.occurred_at)})."
    elif eng.last is not None:
        subject = f"Checking in on the {topic}"
        body = (
            f"Hi {first},\n\n"
            f"It's been a little while since we last spoke{f' about {last_subject.lower()}' if last_subject else ''}. "
            f"I wanted to check whether the {topic} is still a priority for {company} this quarter — "
            "happy to adapt the plan if things have changed on your side.\n\n"
            f"Would a quick 20-minute call on {day1} or {day2} help?\n\n"
            f"Best,\n{sender}"
        )
        note = f"Re-engages after the last touch {ago(eng.last.occurred_at)}."
    else:
        subject = f"Quick intro — {company}"
        body = (
            f"Hi {first},\n\n"
            f"I'd love to learn what {company} is focused on this quarter and share a couple of ideas "
            "that have worked well for similar teams — no pitch deck, just a conversation.\n\n"
            f"Open to a short call on {day1} or {day2}?\n\n"
            f"Best,\n{sender}"
        )
        note = "First outreach — no previous conversations."

    # Saved drafts land on the contact's timeline (which also shows their deals).
    related_type, related_id = "contact", contact.id
    return EmailDraft(
        to=contact.email,
        to_name=contact.full_name,
        subject=subject,
        body=body,
        contact_id=contact.id,
        related_type=related_type,
        related_id=related_id,
        context_note=note,
    )
