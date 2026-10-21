"""Helpers shared by record services: owner checks, change diffs, JSON-safe values."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import delete, select

from app.errors import ValidationFailed
from app.models import Activity, Membership, Note, Task
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
