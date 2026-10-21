"""Exact-restore helpers used by agent tools to undo their own mutations."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete

from app.models import Activity, Company, Contact, Deal, Note, Task
from app.services.context import Ctx
from app.services.scoping import get_scoped, scoped
from app.services.scoring import score_contacts


async def delete_activities(ctx: Ctx, ids: list[uuid.UUID]) -> None:
    if ids:
        await ctx.session.execute(
            delete(Activity).where(Activity.workspace_id == ctx.workspace_id, Activity.id.in_(ids))
        )


async def delete_tasks(ctx: Ctx, ids: list[uuid.UUID]) -> None:
    if ids:
        await ctx.session.execute(
            delete(Task).where(Task.workspace_id == ctx.workspace_id, Task.id.in_(ids))
        )


async def delete_note(ctx: Ctx, note_id: uuid.UUID) -> None:
    await ctx.session.execute(
        delete(Note).where(Note.workspace_id == ctx.workspace_id, Note.id == note_id)
    )


def _dt(raw: Any) -> datetime | None:
    return datetime.fromisoformat(raw) if isinstance(raw, str) else None


async def restore_deal(ctx: Ctx, deal_id: uuid.UUID, snapshot: dict[str, Any]) -> Deal:
    """Put a deal back exactly as captured by `snapshot_deal`."""
    deal = await get_scoped(ctx, Deal, deal_id, "Deal")
    deal.stage_id = uuid.UUID(snapshot["stage_id"])
    deal.position = float(snapshot["position"])
    deal.stage_entered_at = _dt(snapshot.get("stage_entered_at"))
    deal.last_activity_at = _dt(snapshot.get("last_activity_at"))
    deal.updated_at = _dt(snapshot.get("updated_at")) or deal.updated_at
    for key in (
        "name",
        "currency",
        "expected_close",
        "owner_id",
        "company_id",
        "primary_contact_id",
    ):
        if key in snapshot:
            value = snapshot[key]
            if key in ("owner_id", "company_id", "primary_contact_id") and isinstance(value, str):
                value = uuid.UUID(value)
            if key == "expected_close" and isinstance(value, str):
                value = datetime.fromisoformat(value).date()
            setattr(deal, key, value)
    if "value" in snapshot:
        deal.value = Decimal(str(snapshot["value"]))
    if "custom" in snapshot:
        deal.custom = dict(snapshot["custom"])
    await ctx.session.flush()
    return deal


def snapshot_deal(deal: Deal) -> dict[str, Any]:
    return {
        "stage_id": str(deal.stage_id),
        "position": deal.position,
        "stage_entered_at": deal.stage_entered_at.isoformat() if deal.stage_entered_at else None,
        "last_activity_at": deal.last_activity_at.isoformat() if deal.last_activity_at else None,
        "updated_at": deal.updated_at.isoformat() if deal.updated_at else None,
        "name": deal.name,
        "value": str(deal.value),
        "currency": deal.currency,
        "expected_close": deal.expected_close.isoformat() if deal.expected_close else None,
        "owner_id": str(deal.owner_id) if deal.owner_id else None,
        "company_id": str(deal.company_id) if deal.company_id else None,
        "primary_contact_id": str(deal.primary_contact_id) if deal.primary_contact_id else None,
        "custom": dict(deal.custom or {}),
    }


_RECORD_FIELDS: dict[str, tuple[str, ...]] = {
    "company": ("name", "domain", "industry", "size", "logo_url", "owner_id"),
    "contact": (
        "first_name",
        "last_name",
        "company_id",
        "email",
        "phone",
        "title",
        "owner_id",
        "lead_status",
    ),
}


async def restore_simple_record(
    ctx: Ctx, record_type: str, record_id: uuid.UUID, snapshot: dict[str, Any]
) -> None:
    """Restore a company/contact from a snapshot of its columns + custom values."""
    record: Company | Contact
    if record_type == "company":
        record = await get_scoped(ctx, Company, record_id, "Company")
    else:
        record = await get_scoped(ctx, Contact, record_id, "Contact")
    for key in _RECORD_FIELDS[record_type]:
        if key in snapshot:
            value = snapshot[key]
            if key.endswith("_id") and isinstance(value, str):
                value = uuid.UUID(value)
            setattr(record, key, value)
    if "custom" in snapshot:
        record.custom = dict(snapshot["custom"])
    if snapshot.get("updated_at"):
        record.updated_at = datetime.fromisoformat(snapshot["updated_at"])
    await ctx.session.flush()
    if isinstance(record, Contact):
        await score_contacts(ctx, [record])


def snapshot_simple_record(record: Company | Contact, record_type: str) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key in _RECORD_FIELDS[record_type]:
        value = getattr(record, key)
        out[key] = str(value) if isinstance(value, uuid.UUID) else value
    out["custom"] = dict(record.custom or {})
    out["updated_at"] = record.updated_at.isoformat() if record.updated_at else None
    return out


async def rescore_deal_contact(ctx: Ctx, deal: Deal) -> None:
    if deal.primary_contact_id is None:
        return
    contact = await ctx.session.scalar(
        scoped(Contact, ctx.workspace_id).where(Contact.id == deal.primary_contact_id)
    )
    if contact is not None:
        await score_contacts(ctx, [contact])
