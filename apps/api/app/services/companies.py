import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy import func, or_, select

from app.models import Activity, Company, Contact, Deal, Stage
from app.schemas.records import CompanyCreate, CompanyFilter, CompanyOut, CompanyUpdate
from app.services import fields as fields_service
from app.services.activities import record_activity
from app.services.common import diff_changes, ensure_member, purge_related
from app.services.context import Ctx
from app.services.listing import ListParams, like, sort_clauses
from app.services.scoping import get_scoped, scoped

LABELS = {
    "name": "Name",
    "domain": "Domain",
    "industry": "Industry",
    "size": "Size",
    "logo_url": "Logo",
    "owner_id": "Owner",
}
_BUILTIN = tuple(LABELS)


async def enrich(ctx: Ctx, companies: list[Company]) -> list[CompanyOut]:
    ids = [c.id for c in companies]
    if not ids:
        return []
    contacts = dict(
        (
            await ctx.session.execute(
                select(Contact.company_id, func.count())
                .where(Contact.workspace_id == ctx.workspace_id, Contact.company_id.in_(ids))
                .group_by(Contact.company_id)
            )
        )
        .tuples()
        .all()
    )
    deal_rows = (
        await ctx.session.execute(
            select(Deal.company_id, func.count(), func.coalesce(func.sum(Deal.value), 0))
            .join(Stage, Stage.id == Deal.stage_id)
            .where(
                Deal.workspace_id == ctx.workspace_id,
                Deal.company_id.in_(ids),
                Stage.kind == "open",
            )
            .group_by(Deal.company_id)
        )
    ).all()
    deals = {cid: (int(n), Decimal(v)) for cid, n, v in deal_rows}
    contact_ids = select(Contact.id).where(
        Contact.workspace_id == ctx.workspace_id, Contact.company_id == Company.id
    )
    last_rows = (
        await ctx.session.execute(
            select(Company.id, func.max(Activity.occurred_at))
            .join(
                Activity,
                or_(
                    (Activity.related_type == "company") & (Activity.related_id == Company.id),
                    (Activity.related_type == "contact")
                    & Activity.related_id.in_(contact_ids.scalar_subquery()),
                ),
            )
            .where(Company.id.in_(ids), Activity.workspace_id == ctx.workspace_id)
            .group_by(Company.id)
        )
    ).all()
    last = dict(last_rows)
    out: list[CompanyOut] = []
    for c in companies:
        n_deals, value = deals.get(c.id, (0, Decimal("0")))
        item = CompanyOut.model_validate(c)
        item.contacts_count = int(contacts.get(c.id, 0))
        item.open_deals_count = n_deals
        item.open_deals_value = value
        item.last_activity_at = last.get(c.id)
        out.append(item)
    return out


async def list_companies(
    ctx: Ctx, params: ListParams, flt: CompanyFilter
) -> tuple[list[CompanyOut], int]:
    stmt = scoped(Company, ctx.workspace_id)
    if params.q:
        pattern = like(params.q)
        stmt = stmt.where(or_(Company.name.ilike(pattern), Company.domain.ilike(pattern)))
    if flt.ids:
        stmt = stmt.where(Company.id.in_(flt.ids))
    if flt.owner_id:
        stmt = stmt.where(Company.owner_id == flt.owner_id)
    if flt.industry:
        stmt = stmt.where(Company.industry == flt.industry)
    if flt.size:
        stmt = stmt.where(Company.size == flt.size)
    if flt.custom:
        stmt = stmt.where(Company.custom.contains(flt.custom))
    total = await ctx.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    defs = await fields_service.list_definitions(ctx, "company")
    order = sort_clauses(
        params.sort,
        {
            "name": Company.name,
            "domain": Company.domain,
            "industry": Company.industry,
            "size": Company.size,
            "created_at": Company.created_at,
            "updated_at": Company.updated_at,
        },
        custom_col=Company.custom,
        custom_defs=defs,
        default="name",
    )
    stmt = stmt.order_by(*order, Company.id).offset(params.offset).limit(params.safe_limit)
    rows = list((await ctx.session.scalars(stmt)).all())
    return await enrich(ctx, rows), total


async def get_company(ctx: Ctx, company_id: uuid.UUID) -> CompanyOut:
    company = await get_scoped(ctx, Company, company_id, "Company")
    return (await enrich(ctx, [company]))[0]


async def create_company(ctx: Ctx, data: CompanyCreate) -> CompanyOut:
    await ensure_member(ctx, data.owner_id)
    custom = await fields_service.validate_custom(ctx, "company", data.custom)
    company = Company(
        workspace_id=ctx.workspace_id,
        name=data.name.strip(),
        domain=data.domain,
        industry=data.industry,
        size=data.size,
        logo_url=data.logo_url,
        owner_id=data.owner_id or ctx.user_id,
        custom=custom,
    )
    ctx.session.add(company)
    await ctx.session.flush()
    await record_activity(ctx, "record_created", "company", company.id, {"name": company.name})
    return await get_company(ctx, company.id)


async def update_company(ctx: Ctx, company_id: uuid.UUID, data: CompanyUpdate) -> CompanyOut:
    company = await get_scoped(ctx, Company, company_id, "Company")
    patch = data.model_dump(exclude_unset=True)
    before: dict[str, Any] = {k: getattr(company, k) for k in _BUILTIN}
    before_custom = dict(company.custom or {})
    if "owner_id" in patch:
        await ensure_member(ctx, patch["owner_id"])
    for key in _BUILTIN:
        if key in patch:
            setattr(company, key, patch[key].strip() if key == "name" else patch[key])
    if patch.get("custom") is not None:
        company.custom = await fields_service.validate_custom(
            ctx, "company", patch["custom"], existing=company.custom, partial=True
        )
    labels = {
        **LABELS,
        **{d.key: d.label for d in await fields_service.list_definitions(ctx, "company")},
    }
    changes = diff_changes(
        {**before, **before_custom},
        {**{k: getattr(company, k) for k in _BUILTIN}, **(company.custom or {})},
        labels,
    )
    await ctx.session.flush()
    if changes:
        await record_activity(ctx, "field_updated", "company", company.id, {"changes": changes})
    return await get_company(ctx, company.id)


async def delete_company(ctx: Ctx, company_id: uuid.UUID) -> None:
    company = await get_scoped(ctx, Company, company_id, "Company")
    await purge_related(ctx, "company", company.id)
    await ctx.session.delete(company)
    await ctx.session.flush()
