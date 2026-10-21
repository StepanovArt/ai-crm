import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, or_, select

from app.errors import NotFoundError, ValidationFailed
from app.models import Activity, Company, Contact, Deal, Pipeline, Stage
from app.models.base import utcnow
from app.schemas.records import (
    CompanyBrief,
    DealCreate,
    DealFilter,
    DealMove,
    DealOut,
    DealUpdate,
    StageBrief,
)
from app.services import fields as fields_service
from app.services.activities import record_activity
from app.services.common import diff_changes, ensure_member, humanize_changes, purge_related
from app.services.contacts import brief as contact_brief
from app.services.context import Ctx
from app.services.listing import ListParams, like, sort_clauses
from app.services.scoping import get_scoped, get_stage, scoped, scoped_stages
from app.services.scoring import score_contacts

LABELS = {
    "name": "Name",
    "value": "Value",
    "currency": "Currency",
    "company_id": "Company",
    "primary_contact_id": "Primary contact",
    "owner_id": "Owner",
    "expected_close": "Expected close",
}
_BUILTIN = tuple(LABELS)
POSITION_GAP = 1000.0
AGENT_TOUCH_WINDOW = timedelta(hours=24)


async def enrich(ctx: Ctx, deals: list[Deal]) -> list[DealOut]:
    if not deals:
        return []
    stage_ids = {d.stage_id for d in deals}
    stages = {
        s.id: s
        for s in (
            await ctx.session.scalars(
                scoped_stages(ctx.workspace_id).where(Stage.id.in_(stage_ids))
            )
        ).all()
    }
    company_ids = {d.company_id for d in deals if d.company_id}
    companies = {
        c.id: c
        for c in (
            await ctx.session.scalars(
                scoped(Company, ctx.workspace_id).where(Company.id.in_(company_ids))
            )
        ).all()
    }
    contact_ids = {d.primary_contact_id for d in deals if d.primary_contact_id}
    contacts = {
        c.id: c
        for c in (
            await ctx.session.scalars(
                scoped(Contact, ctx.workspace_id).where(Contact.id.in_(contact_ids))
            )
        ).all()
    }
    deal_ids = [d.id for d in deals]
    touched = dict(
        (
            await ctx.session.execute(
                select(Activity.related_id, func.max(Activity.occurred_at))
                .where(
                    Activity.workspace_id == ctx.workspace_id,
                    Activity.actor_type == "agent",
                    Activity.related_type == "deal",
                    Activity.related_id.in_(deal_ids),
                    Activity.occurred_at >= utcnow() - AGENT_TOUCH_WINDOW,
                )
                .group_by(Activity.related_id)
            )
        )
        .tuples()
        .all()
    )
    out: list[DealOut] = []
    for d in deals:
        item = DealOut.model_validate(d)
        stage = stages.get(d.stage_id)
        item.stage = StageBrief.model_validate(stage) if stage else None
        company = companies.get(d.company_id) if d.company_id else None
        item.company = CompanyBrief.model_validate(company) if company else None
        contact = contacts.get(d.primary_contact_id) if d.primary_contact_id else None
        item.primary_contact = contact_brief(contact) if contact else None
        item.agent_touched_at = touched.get(d.id)
        out.append(item)
    return out


def _filtered(ctx: Ctx, flt: DealFilter, q: str | None = None) -> Any:
    stmt = scoped(Deal, ctx.workspace_id).join(Stage, Stage.id == Deal.stage_id)
    if q:
        pattern = like(q)
        company_match = select(Company.id).where(
            Company.workspace_id == ctx.workspace_id, Company.name.ilike(pattern)
        )
        stmt = stmt.where(or_(Deal.name.ilike(pattern), Deal.company_id.in_(company_match)))
    if flt.ids:
        stmt = stmt.where(Deal.id.in_(flt.ids))
    if flt.pipeline_id:
        stmt = stmt.where(Deal.pipeline_id == flt.pipeline_id)
    if flt.stage_id:
        stmt = stmt.where(Deal.stage_id == flt.stage_id)
    if flt.stage_ids:
        stmt = stmt.where(Deal.stage_id.in_(flt.stage_ids))
    if flt.owner_id:
        stmt = stmt.where(Deal.owner_id == flt.owner_id)
    if flt.company_id:
        stmt = stmt.where(Deal.company_id == flt.company_id)
    if flt.primary_contact_id:
        stmt = stmt.where(Deal.primary_contact_id == flt.primary_contact_id)
    if flt.status:
        stmt = stmt.where(Stage.kind == flt.status)
    if flt.value_min is not None:
        stmt = stmt.where(Deal.value >= flt.value_min)
    if flt.value_max is not None:
        stmt = stmt.where(Deal.value <= flt.value_max)
    if flt.stale_days is not None:
        cutoff = utcnow() - timedelta(days=flt.stale_days)
        stmt = stmt.where(
            Stage.kind == "open",
            or_(Deal.last_activity_at.is_(None), Deal.last_activity_at < cutoff),
        )
    if flt.close_before:
        stmt = stmt.where(Deal.expected_close <= flt.close_before)
    if flt.close_after:
        stmt = stmt.where(Deal.expected_close >= flt.close_after)
    if flt.custom:
        stmt = stmt.where(Deal.custom.contains(flt.custom))
    return stmt


async def list_deals(ctx: Ctx, params: ListParams, flt: DealFilter) -> tuple[list[DealOut], int]:
    stmt = _filtered(ctx, flt, params.q)
    total = await ctx.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    defs = await fields_service.list_definitions(ctx, "deal")
    order = sort_clauses(
        params.sort,
        {
            "name": Deal.name,
            "value": Deal.value,
            "expected_close": Deal.expected_close,
            "created_at": Deal.created_at,
            "updated_at": Deal.updated_at,
            "last_activity_at": Deal.last_activity_at,
            "position": Deal.position,
            "stage": Stage.position,
        },
        custom_col=Deal.custom,
        custom_defs=defs,
        default="stage,position",
    )
    stmt = stmt.order_by(*order, Deal.id).offset(params.offset).limit(params.safe_limit)
    rows = list((await ctx.session.scalars(stmt)).all())
    return await enrich(ctx, rows), total


async def list_all_deals(ctx: Ctx, flt: DealFilter) -> list[DealOut]:
    stmt = _filtered(ctx, flt).order_by(Stage.position, Deal.position, Deal.id)
    return await enrich(ctx, list((await ctx.session.scalars(stmt)).all()))


async def get_deal(ctx: Ctx, deal_id: uuid.UUID) -> DealOut:
    deal = await get_scoped(ctx, Deal, deal_id, "Deal")
    return (await enrich(ctx, [deal]))[0]


async def default_pipeline(ctx: Ctx) -> Pipeline:
    pipeline = await ctx.session.scalar(
        scoped(Pipeline, ctx.workspace_id).order_by(Pipeline.position, Pipeline.created_at).limit(1)
    )
    if pipeline is None:
        raise NotFoundError("This workspace has no pipeline yet")
    return pipeline


async def _first_stage(ctx: Ctx, pipeline_id: uuid.UUID) -> Stage:
    stage = await ctx.session.scalar(
        select(Stage).where(Stage.pipeline_id == pipeline_id).order_by(Stage.position).limit(1)
    )
    if stage is None:
        raise ValidationFailed("Pipeline has no stages")
    return stage


async def _end_position(ctx: Ctx, stage_id: uuid.UUID) -> float:
    current = await ctx.session.scalar(
        select(func.max(Deal.position)).where(
            Deal.workspace_id == ctx.workspace_id, Deal.stage_id == stage_id
        )
    )
    return (current if current is not None else -POSITION_GAP) + POSITION_GAP


async def _check_links(
    ctx: Ctx, company_id: uuid.UUID | None, contact_id: uuid.UUID | None
) -> None:
    if company_id is not None:
        await get_scoped(ctx, Company, company_id, "Company")
    if contact_id is not None:
        await get_scoped(ctx, Contact, contact_id, "Contact")


async def create_deal(ctx: Ctx, data: DealCreate) -> DealOut:
    await ensure_member(ctx, data.owner_id)
    await _check_links(ctx, data.company_id, data.primary_contact_id)
    if data.stage_id is not None:
        stage = await get_stage(ctx, data.stage_id)
        pipeline_id = stage.pipeline_id
    else:
        pipeline = (
            await get_scoped(ctx, Pipeline, data.pipeline_id, "Pipeline")
            if data.pipeline_id
            else await default_pipeline(ctx)
        )
        pipeline_id = pipeline.id
        stage = await _first_stage(ctx, pipeline_id)
    custom = await fields_service.validate_custom(ctx, "deal", data.custom)
    now = utcnow()
    deal = Deal(
        workspace_id=ctx.workspace_id,
        pipeline_id=pipeline_id,
        stage_id=stage.id,
        name=data.name.strip(),
        value=data.value,
        currency=data.currency.upper(),
        company_id=data.company_id,
        primary_contact_id=data.primary_contact_id,
        owner_id=data.owner_id or ctx.user_id,
        expected_close=data.expected_close,
        position=await _end_position(ctx, stage.id),
        custom=custom,
        stage_entered_at=now,
        last_activity_at=now,
    )
    ctx.session.add(deal)
    await ctx.session.flush()
    await record_activity(
        ctx, "record_created", "deal", deal.id, {"name": deal.name, "stage": stage.name}
    )
    return await get_deal(ctx, deal.id)


async def update_deal(ctx: Ctx, deal_id: uuid.UUID, data: DealUpdate) -> DealOut:
    deal = await get_scoped(ctx, Deal, deal_id, "Deal")
    patch = data.model_dump(exclude_unset=True)
    if "stage_id" in patch and patch["stage_id"] is not None and patch["stage_id"] != deal.stage_id:
        await move_deal(ctx, deal.id, DealMove(stage_id=patch["stage_id"]))
    before: dict[str, Any] = {k: getattr(deal, k) for k in _BUILTIN}
    before_custom = dict(deal.custom or {})
    if "owner_id" in patch:
        await ensure_member(ctx, patch["owner_id"])
    await _check_links(ctx, patch.get("company_id"), patch.get("primary_contact_id"))
    for key in _BUILTIN:
        if key in patch:
            value = patch[key]
            if key == "name" and isinstance(value, str):
                value = value.strip()
            if key == "currency" and isinstance(value, str):
                value = value.upper()
            if key == "value" and value is None:
                value = Decimal("0")
            setattr(deal, key, value)
    if patch.get("custom") is not None:
        deal.custom = await fields_service.validate_custom(
            ctx, "deal", patch["custom"], existing=deal.custom, partial=True
        )
    defs = await fields_service.list_definitions(ctx, "deal")
    labels = {**LABELS, **{d.key: d.label for d in defs}}
    changes = diff_changes(
        {**before, **before_custom},
        {**{k: getattr(deal, k) for k in _BUILTIN}, **(deal.custom or {})},
        labels,
    )
    await ctx.session.flush()
    if changes:
        changes = await humanize_changes(ctx, changes, defs)
        await record_activity(ctx, "field_updated", "deal", deal.id, {"changes": changes})
    if "primary_contact_id" in patch:
        await _rescore(ctx, [before.get("primary_contact_id"), deal.primary_contact_id])
    return await get_deal(ctx, deal.id)


async def _rescore(ctx: Ctx, contact_ids: list[Any]) -> None:
    ids = [c for c in contact_ids if isinstance(c, uuid.UUID)]
    if ids:
        contacts = list(
            (
                await ctx.session.scalars(
                    scoped(Contact, ctx.workspace_id).where(Contact.id.in_(ids))
                )
            ).all()
        )
        await score_contacts(ctx, contacts)


async def _position_at(ctx: Ctx, deal: Deal, stage_id: uuid.UUID, index: int | None) -> float:
    siblings = list(
        (
            await ctx.session.scalars(
                select(Deal.position)
                .where(
                    Deal.workspace_id == ctx.workspace_id,
                    Deal.stage_id == stage_id,
                    Deal.id != deal.id,
                )
                .order_by(Deal.position, Deal.id)
            )
        ).all()
    )
    if index is None or index >= len(siblings):
        return (siblings[-1] + POSITION_GAP) if siblings else 0.0
    if index <= 0:
        return siblings[0] - POSITION_GAP
    return (siblings[index - 1] + siblings[index]) / 2


async def move_deal(ctx: Ctx, deal_id: uuid.UUID, data: DealMove) -> DealOut:
    deal = await get_scoped(ctx, Deal, deal_id, "Deal")
    target = await get_stage(ctx, data.stage_id)
    if target.pipeline_id != deal.pipeline_id:
        raise ValidationFailed("Stage belongs to a different pipeline")
    previous = await get_stage(ctx, deal.stage_id)
    deal.position = await _position_at(ctx, deal, target.id, data.index)
    if target.id != previous.id:
        now = utcnow()
        deal.stage_id = target.id
        deal.stage_entered_at = now
        await ctx.session.flush()
        await record_activity(
            ctx,
            "stage_changed",
            "deal",
            deal.id,
            {
                "from_stage_id": str(previous.id),
                "from_stage": previous.name,
                "to_stage_id": str(target.id),
                "to_stage": target.name,
            },
            occurred_at=now,
        )
    await ctx.session.flush()
    return await get_deal(ctx, deal.id)


async def delete_deal(ctx: Ctx, deal_id: uuid.UUID) -> None:
    deal = await get_scoped(ctx, Deal, deal_id, "Deal")
    contact_id = deal.primary_contact_id
    await purge_related(ctx, "deal", deal.id)
    await ctx.session.delete(deal)
    await ctx.session.flush()
    await _rescore(ctx, [contact_id])


async def stage_totals(
    ctx: Ctx, pipeline_id: uuid.UUID, flt: DealFilter
) -> dict[uuid.UUID, tuple[int, Decimal, Decimal]]:
    """count, total value and probability-weighted value per stage."""
    base = _filtered(ctx, flt.model_copy(update={"pipeline_id": pipeline_id})).subquery()
    rows = (
        await ctx.session.execute(
            select(
                Stage.id,
                func.count(base.c.id),
                func.coalesce(func.sum(base.c.value), 0),
                func.coalesce(func.sum(base.c.value * Stage.probability / 100.0), 0),
            )
            .select_from(Stage)
            .outerjoin(base, and_(base.c.stage_id == Stage.id))
            .where(Stage.pipeline_id == pipeline_id)
            .group_by(Stage.id)
        )
    ).all()
    return {
        sid: (
            int(n),
            Decimal(total).quantize(Decimal("0.01")),
            Decimal(weighted).quantize(Decimal("0.01")),
        )
        for sid, n, total, weighted in rows
    }
