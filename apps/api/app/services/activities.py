"""Activity writer. Every mutating service calls `record_activity`."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import datetime
from typing import Any, Literal

from sqlalchemy import and_, or_, select
from sqlalchemy.sql.elements import ColumnElement

from app.models import Activity, Contact, Deal
from app.models.base import utcnow
from app.services.context import Ctx
from app.services.scoping import scoped
from app.services.scoring import INTERACTION_TYPES, score_contacts

ActivityType = Literal[
    "email_sent",
    "email_received",
    "call",
    "meeting",
    "note",
    "stage_changed",
    "field_updated",
    "task_created",
    "task_completed",
    "record_created",
]
RelatedType = Literal["company", "contact", "deal"]

_collector: ContextVar[list[uuid.UUID] | None] = ContextVar("activity_collector", default=None)


@contextmanager
def collect_activities() -> Iterator[list[uuid.UUID]]:
    """Collect ids of activities written inside the block (used for exact agent undo)."""
    ids: list[uuid.UUID] = []
    token = _collector.set(ids)
    try:
        yield ids
    finally:
        _collector.reset(token)


async def record_activity(
    ctx: Ctx,
    type: ActivityType,
    related_type: str,
    related_id: uuid.UUID,
    payload: dict[str, Any] | None = None,
    occurred_at: datetime | None = None,
    *,
    rescore: bool = True,
) -> Activity:
    when = occurred_at or utcnow()
    activity = Activity(
        workspace_id=ctx.workspace_id,
        type=type,
        actor_type=ctx.actor_type,
        actor_id=ctx.user_id,
        related_type=related_type,
        related_id=related_id,
        payload=payload or {},
        occurred_at=when,
    )
    ctx.session.add(activity)
    await ctx.session.flush()
    collected = _collector.get()
    if collected is not None:
        collected.append(activity.id)

    deal_id = _deal_id_for(related_type, related_id, payload or {})
    if deal_id is not None and type in INTERACTION_TYPES:
        deal = await ctx.session.scalar(scoped(Deal, ctx.workspace_id).where(Deal.id == deal_id))
        if deal is not None and (deal.last_activity_at is None or deal.last_activity_at < when):
            deal.last_activity_at = when
    if rescore:
        await _rescore_for(ctx, related_type, related_id, deal_id)
    return activity


async def _rescore_for(
    ctx: Ctx, related_type: str, related_id: uuid.UUID, deal_id: uuid.UUID | None
) -> None:
    contact_id: uuid.UUID | None = related_id if related_type == "contact" else None
    if contact_id is None and deal_id is not None:
        contact_id = await ctx.session.scalar(
            select(Deal.primary_contact_id).where(
                Deal.workspace_id == ctx.workspace_id, Deal.id == deal_id
            )
        )
    if contact_id is None:
        return
    contact = await ctx.session.scalar(
        scoped(Contact, ctx.workspace_id).where(Contact.id == contact_id)
    )
    if contact is not None:
        await score_contacts(ctx, [contact])


def _deal_id_for(
    related_type: str, related_id: uuid.UUID, payload: dict[str, Any]
) -> uuid.UUID | None:
    if related_type == "deal":
        return related_id
    raw = payload.get("deal_id")
    if isinstance(raw, str):
        try:
            return uuid.UUID(raw)
        except ValueError:
            return None
    return None


async def timeline_filter(
    ctx: Ctx, related_type: RelatedType, related_id: uuid.UUID
) -> ColumnElement[bool]:
    """Activities that belong on a record's timeline (including linked records)."""
    own = and_(Activity.related_type == related_type, Activity.related_id == related_id)
    if related_type == "contact":
        deal_ids = select(Deal.id).where(
            Deal.workspace_id == ctx.workspace_id, Deal.primary_contact_id == related_id
        )
        return or_(own, and_(Activity.related_type == "deal", Activity.related_id.in_(deal_ids)))
    if related_type == "deal":
        return or_(own, Activity.payload["deal_id"].astext == str(related_id))
    contact_ids = select(Contact.id).where(
        Contact.workspace_id == ctx.workspace_id, Contact.company_id == related_id
    )
    deal_ids = select(Deal.id).where(
        Deal.workspace_id == ctx.workspace_id, Deal.company_id == related_id
    )
    return or_(
        own,
        and_(Activity.related_type == "contact", Activity.related_id.in_(contact_ids)),
        and_(Activity.related_type == "deal", Activity.related_id.in_(deal_ids)),
    )


async def list_timeline(
    ctx: Ctx,
    related_type: RelatedType,
    related_id: uuid.UUID,
    *,
    limit: int = 50,
    before: datetime | None = None,
) -> list[Activity]:
    cond = await timeline_filter(ctx, related_type, related_id)
    stmt = scoped(Activity, ctx.workspace_id).where(cond)
    if before is not None:
        stmt = stmt.where(Activity.occurred_at < before)
    stmt = stmt.order_by(Activity.occurred_at.desc()).limit(limit)
    return list((await ctx.session.scalars(stmt)).all())
