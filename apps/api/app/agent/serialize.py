"""Compact, JSON-safe record briefs shared by tools, cards and the mock provider."""

from datetime import datetime
from typing import Any

from app.models.base import utcnow
from app.schemas.records import CompanyOut, ContactOut, DealOut
from app.schemas.work import TaskOut


def days_since(when: datetime | None, now: datetime | None = None) -> int | None:
    if when is None:
        return None
    return max(0, ((now or utcnow()) - when).days)


def deal_brief(d: DealOut) -> dict[str, Any]:
    quiet = days_since(d.last_activity_at)
    return {
        "type": "deal",
        "id": str(d.id),
        "title": d.name,
        "subtitle": " · ".join(
            x
            for x in (d.company.name if d.company else None, d.stage.name if d.stage else None)
            if x
        ),
        "value": str(d.value),
        "currency": d.currency,
        "pipeline_id": str(d.pipeline_id),
        "stage": (
            {
                "id": str(d.stage.id),
                "name": d.stage.name,
                "color": d.stage.color,
                "kind": d.stage.kind,
                "probability": d.stage.probability,
            }
            if d.stage
            else None
        ),
        "company": {"id": str(d.company.id), "name": d.company.name} if d.company else None,
        "contact": (
            {
                "id": str(d.primary_contact.id),
                "name": d.primary_contact.full_name,
                "title": d.primary_contact.title,
                "email": d.primary_contact.email,
            }
            if d.primary_contact
            else None
        ),
        "owner_id": str(d.owner_id) if d.owner_id else None,
        "expected_close": d.expected_close.isoformat() if d.expected_close else None,
        "last_activity_at": d.last_activity_at.isoformat() if d.last_activity_at else None,
        "days_quiet": quiet,
        "days_in_stage": days_since(d.stage_entered_at),
        "href": f"/records/deal/{d.id}",
    }


def contact_brief(c: ContactOut) -> dict[str, Any]:
    return {
        "type": "contact",
        "id": str(c.id),
        "title": c.full_name,
        "subtitle": " · ".join(x for x in (c.title, c.company.name if c.company else None) if x),
        "first_name": c.first_name,
        "score": c.score,
        "email": c.email,
        "lead_status": c.lead_status,
        "company": {"id": str(c.company.id), "name": c.company.name} if c.company else None,
        "last_activity_at": c.last_activity_at.isoformat() if c.last_activity_at else None,
        "days_quiet": days_since(c.last_activity_at),
        "href": f"/records/contact/{c.id}",
    }


def company_brief(c: CompanyOut) -> dict[str, Any]:
    return {
        "type": "company",
        "id": str(c.id),
        "title": c.name,
        "subtitle": " · ".join(x for x in (c.domain, c.industry) if x),
        "contacts_count": c.contacts_count,
        "open_deals_count": c.open_deals_count,
        "open_deals_value": str(c.open_deals_value),
        "last_activity_at": c.last_activity_at.isoformat() if c.last_activity_at else None,
        "href": f"/records/company/{c.id}",
    }


def task_brief(t: TaskOut) -> dict[str, Any]:
    related = t.related
    return {
        "type": "task",
        "id": str(t.id),
        "title": t.title,
        "subtitle": related.name if related else None,
        "due_at": t.due_at.isoformat() if t.due_at else None,
        "done": t.done,
        "created_by": t.created_by,
        "related": {"type": related.type, "id": str(related.id), "name": related.name}
        if related
        else None,
        "href": f"/records/{related.type}/{related.id}" if related else "/tasks",
    }
