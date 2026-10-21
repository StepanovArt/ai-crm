"""Helpers shared by record services: owner checks, change diffs, JSON-safe values."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select

from app.errors import ValidationFailed
from app.models import Activity, Company, Contact, FieldDefinition, Membership, Note, Task, User
from app.services.context import Ctx


def json_safe(value: Any) -> Any:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, list):
        return [json_safe(v) for v in value]
    if isinstance(value, dict):
        return {k: json_safe(v) for k, v in value.items()}
    return value


async def ensure_member(ctx: Ctx, user_id: uuid.UUID | None, label: str = "Owner") -> None:
    if user_id is None:
        return
    found = await ctx.session.scalar(
        select(Membership.id).where(
            Membership.workspace_id == ctx.workspace_id, Membership.user_id == user_id
        )
    )
    if found is None:
        raise ValidationFailed(f"{label} must be a member of this workspace")


def diff_changes(
    before: dict[str, Any], after: dict[str, Any], labels: dict[str, str]
) -> list[dict[str, Any]]:
    changes: list[dict[str, Any]] = []
    for key in sorted(set(before) | set(after)):
        old, new = json_safe(before.get(key)), json_safe(after.get(key))
        if old != new:
            changes.append({"field": key, "label": labels.get(key, key), "from": old, "to": new})
    return changes


async def purge_related(ctx: Ctx, related_type: str, related_id: uuid.UUID) -> None:
    """Remove timeline rows, notes and tasks attached to a deleted record."""
    for model in (Activity, Note, Task):
        await ctx.session.execute(
            delete(model).where(
                model.workspace_id == ctx.workspace_id,
                model.related_type == related_type,
                model.related_id == related_id,
            )
        )


async def humanize_changes(
    ctx: Ctx, changes: list[dict[str, Any]], defs: list[FieldDefinition]
) -> list[dict[str, Any]]:
    """Replace ids and option values in change entries with display names."""
    options = {
        d.key: {str(o.get("value")): str(o.get("label")) for o in d.options or []} for d in defs
    }
    user_ids, company_ids, contact_ids = set(), set(), set()
    for c in changes:
        for v in (c["from"], c["to"]):
            if not isinstance(v, str):
                continue
            if c["field"] == "owner_id":
                user_ids.add(v)
            elif c["field"] == "company_id":
                company_ids.add(v)
            elif c["field"] == "primary_contact_id":
                contact_ids.add(v)
    names: dict[str, str] = {}
    if user_ids:
        rows = await ctx.session.execute(
            select(User.id, User.full_name).where(User.id.in_([uuid.UUID(u) for u in user_ids]))
        )
        names.update({str(i): n for i, n in rows.all()})
    if company_ids:
        rows2 = await ctx.session.execute(
            select(Company.id, Company.name).where(
                Company.workspace_id == ctx.workspace_id,
                Company.id.in_([uuid.UUID(c) for c in company_ids]),
            )
        )
        names.update({str(i): n for i, n in rows2.all()})
    if contact_ids:
        rows3 = await ctx.session.execute(
            select(Contact.id, Contact.first_name, Contact.last_name).where(
                Contact.workspace_id == ctx.workspace_id,
                Contact.id.in_([uuid.UUID(c) for c in contact_ids]),
            )
        )
        names.update({str(i): f"{f} {lname}".strip() for i, f, lname in rows3.all()})

    def show(field: str, value: Any) -> Any:
        if value is None:
            return None
        opts = options.get(field)
        if opts is not None:
            if isinstance(value, list):
                return [opts.get(str(v), v) for v in value]
            return opts.get(str(value), value)
        if isinstance(value, str) and value in names:
            return names[value]
        return value

    return [
        {**c, "from": show(c["field"], c["from"]), "to": show(c["field"], c["to"])} for c in changes
    ]
