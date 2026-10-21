import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError, ValidationFailed
from app.models import Membership, User, Workspace
from app.services.context import Ctx

DEFAULT_TERMINOLOGY: dict[str, str] = {
    "deal": "Deal",
    "deals": "Deals",
    "company": "Company",
    "companies": "Companies",
    "contact": "Contact",
    "contacts": "Contacts",
    "pipeline": "Pipeline",
}


def effective_terminology(raw: dict[str, Any] | None) -> dict[str, str]:
    merged = dict(DEFAULT_TERMINOLOGY)
    for key, value in (raw or {}).items():
        if key in merged and isinstance(value, str) and value.strip():
            merged[key] = value.strip()
    return merged


async def get_workspace(ctx: Ctx) -> Workspace:
    ws = await ctx.session.get(Workspace, ctx.workspace_id)
    if ws is None:
        raise NotFoundError("Workspace not found")
    return ws


async def list_members(session: AsyncSession, workspace_id: uuid.UUID) -> list[tuple[User, str]]:
    rows = await session.execute(
        select(User, Membership.role)
        .join(Membership, Membership.user_id == User.id)
        .where(Membership.workspace_id == workspace_id)
        .order_by(Membership.created_at)
    )
    return [(u, r) for u, r in rows.all()]


async def update_workspace(
    ctx: Ctx, *, name: str | None = None, terminology: dict[str, str] | None = None
) -> Workspace:
    ws = await get_workspace(ctx)
    if name is not None:
        ws.name = name.strip()
    if terminology is not None:
        unknown = set(terminology) - set(DEFAULT_TERMINOLOGY)
        if unknown:
            raise ValidationFailed(f"Unknown terminology key(s): {', '.join(sorted(unknown))}")
        ws.terminology = effective_terminology({**(ws.terminology or {}), **terminology})
    await ctx.session.flush()
    return ws
