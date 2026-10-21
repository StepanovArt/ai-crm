"""Resolve (related_type, related_id) pairs into display briefs in bulk."""

import uuid
from collections import defaultdict
from collections.abc import Iterable

from sqlalchemy import select

from app.errors import ValidationFailed
from app.models import Company, Contact, Deal
from app.schemas.work import RelatedBrief
from app.services.context import Ctx
from app.services.scoping import get_scoped

RELATED_TYPES = ("company", "contact", "deal")


async def resolve(
    ctx: Ctx, pairs: Iterable[tuple[str | None, uuid.UUID | None]]
) -> dict[tuple[str, uuid.UUID], RelatedBrief]:
    by_type: dict[str, set[uuid.UUID]] = defaultdict(set)
    for rtype, rid in pairs:
        if rtype in RELATED_TYPES and rid is not None:
            by_type[rtype].add(rid)
    out: dict[tuple[str, uuid.UUID], RelatedBrief] = {}
    if by_type.get("company"):
        rows = await ctx.session.execute(
            select(Company.id, Company.name).where(
                Company.workspace_id == ctx.workspace_id, Company.id.in_(by_type["company"])
            )
        )
        for cid, name in rows.all():
            out[("company", cid)] = RelatedBrief(type="company", id=cid, name=name)
    if by_type.get("contact"):
        rows2 = await ctx.session.execute(
            select(Contact.id, Contact.first_name, Contact.last_name).where(
                Contact.workspace_id == ctx.workspace_id, Contact.id.in_(by_type["contact"])
            )
        )
        for cid, first, last in rows2.all():
            out[("contact", cid)] = RelatedBrief(
                type="contact", id=cid, name=f"{first} {last}".strip()
            )
    if by_type.get("deal"):
        rows3 = await ctx.session.execute(
            select(Deal.id, Deal.name).where(
                Deal.workspace_id == ctx.workspace_id, Deal.id.in_(by_type["deal"])
            )
        )
        for did, name in rows3.all():
            out[("deal", did)] = RelatedBrief(type="deal", id=did, name=name)
    return out


async def ensure_related(ctx: Ctx, related_type: str | None, related_id: uuid.UUID | None) -> None:
    if related_type is None and related_id is None:
        return
    if related_type not in RELATED_TYPES or related_id is None:
        raise ValidationFailed("related_type and related_id must be provided together")
    if related_type == "company":
        await get_scoped(ctx, Company, related_id, "Company")
    elif related_type == "contact":
        await get_scoped(ctx, Contact, related_id, "Contact")
    else:
        await get_scoped(ctx, Deal, related_id, "Deal")
