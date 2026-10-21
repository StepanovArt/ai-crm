import uuid
from typing import Any

from sqlalchemy import func, or_, select

from app.errors import ValidationFailed
from app.models import Activity, Company, Contact, Deal, Stage
from app.schemas.records import (
    CompanyBrief,
    ContactBrief,
    ContactCreate,
    ContactFilter,
    ContactOut,
    ContactUpdate,
    ScoreOut,
    ScoreSignalOut,
)
from app.services import fields as fields_service
from app.services.activities import record_activity
from app.services.common import diff_changes, ensure_member, humanize_changes, purge_related
from app.services.context import Ctx
from app.services.listing import ListParams, like, sort_clauses
from app.services.scoping import get_scoped, scoped
from app.services.scoring import score_contact, score_contacts

LABELS = {
    "first_name": "First name",
    "last_name": "Last name",
    "company_id": "Company",
    "email": "Email",
    "phone": "Phone",
    "title": "Title",
    "owner_id": "Owner",
    "lead_status": "Lead status",
}
_BUILTIN = tuple(LABELS)


def full_name(c: Contact) -> str:
    return f"{c.first_name} {c.last_name}".strip()


def brief(c: Contact) -> ContactBrief:
    return ContactBrief(id=c.id, full_name=full_name(c), title=c.title, email=c.email)


async def enrich(ctx: Ctx, contacts: list[Contact]) -> list[ContactOut]:
    if not contacts:
        return []
    company_ids = {c.company_id for c in contacts if c.company_id}
    companies = {
        co.id: co
        for co in (
            await ctx.session.scalars(
                scoped(Company, ctx.workspace_id).where(Company.id.in_(company_ids))
            )
        ).all()
    }
    ids = [c.id for c in contacts]
    deal_ids = select(Deal.id).where(
        Deal.workspace_id == ctx.workspace_id, Deal.primary_contact_id == Contact.id
    )
    last = dict(
        (
            await ctx.session.execute(
                select(Contact.id, func.max(Activity.occurred_at))
                .join(
                    Activity,
                    or_(
                        (Activity.related_type == "contact") & (Activity.related_id == Contact.id),
                        (Activity.related_type == "deal")
                        & Activity.related_id.in_(deal_ids.scalar_subquery()),
                    ),
                )
                .where(Contact.id.in_(ids), Activity.workspace_id == ctx.workspace_id)
                .group_by(Contact.id)
            )
        )
        .tuples()
        .all()
    )
    out: list[ContactOut] = []
    for c in contacts:
        item = ContactOut.model_validate(c)
        item.full_name = full_name(c)
        co = companies.get(c.company_id) if c.company_id else None
        item.company = CompanyBrief.model_validate(co) if co else None
        item.last_activity_at = last.get(c.id)
        out.append(item)
    return out


async def list_contacts(
    ctx: Ctx, params: ListParams, flt: ContactFilter
) -> tuple[list[ContactOut], int]:
    stmt = scoped(Contact, ctx.workspace_id)
    if params.q:
        pattern = like(params.q)
        company_match = select(Company.id).where(
            Company.workspace_id == ctx.workspace_id, Company.name.ilike(pattern)
        )
        stmt = stmt.where(
            or_(
                (Contact.first_name + " " + Contact.last_name).ilike(pattern),
                Contact.email.ilike(pattern),
                Contact.title.ilike(pattern),
                Contact.company_id.in_(company_match),
            )
        )
    if flt.ids:
        stmt = stmt.where(Contact.id.in_(flt.ids))
    if flt.owner_id:
        stmt = stmt.where(Contact.owner_id == flt.owner_id)
    if flt.company_id:
        stmt = stmt.where(Contact.company_id == flt.company_id)
    if flt.lead_status:
        stmt = stmt.where(Contact.lead_status == flt.lead_status)
    if flt.score_min is not None:
        stmt = stmt.where(Contact.score >= flt.score_min)
    if flt.score_max is not None:
        stmt = stmt.where(Contact.score <= flt.score_max)
    if flt.has_open_deal is not None:
        open_contacts = (
            select(Deal.primary_contact_id)
            .join(Stage, Stage.id == Deal.stage_id)
            .where(Deal.workspace_id == ctx.workspace_id, Stage.kind == "open")
        )
        cond = Contact.id.in_(open_contacts)
        stmt = stmt.where(cond if flt.has_open_deal else ~cond)
    if flt.custom:
        stmt = stmt.where(Contact.custom.contains(flt.custom))
    total = await ctx.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    defs = await fields_service.list_definitions(ctx, "contact")
    order = sort_clauses(
        params.sort,
        {
            "name": Contact.first_name,
            "last_name": Contact.last_name,
            "email": Contact.email,
            "title": Contact.title,
            "score": Contact.score,
            "lead_status": Contact.lead_status,
            "created_at": Contact.created_at,
            "updated_at": Contact.updated_at,
        },
        custom_col=Contact.custom,
        custom_defs=defs,
        default="-score,name",
    )
    stmt = stmt.order_by(*order, Contact.id).offset(params.offset).limit(params.safe_limit)
    rows = list((await ctx.session.scalars(stmt)).all())
    return await enrich(ctx, rows), total


async def get_contact(ctx: Ctx, contact_id: uuid.UUID) -> ContactOut:
    contact = await get_scoped(ctx, Contact, contact_id, "Contact")
    return (await enrich(ctx, [contact]))[0]


async def _check_company(ctx: Ctx, company_id: uuid.UUID | None) -> None:
    if company_id is not None:
        await get_scoped(ctx, Company, company_id, "Company")


async def create_contact(ctx: Ctx, data: ContactCreate) -> ContactOut:
    await ensure_member(ctx, data.owner_id)
    await _check_company(ctx, data.company_id)
    custom = await fields_service.validate_custom(ctx, "contact", data.custom)
    if data.email and "@" not in data.email:
        raise ValidationFailed("Email must be a valid email address")
    contact = Contact(
        workspace_id=ctx.workspace_id,
        company_id=data.company_id,
        first_name=data.first_name.strip(),
        last_name=data.last_name.strip(),
        email=data.email.strip().lower() if data.email else None,
        phone=data.phone,
        title=data.title,
        owner_id=data.owner_id or ctx.user_id,
        lead_status=data.lead_status,
        score=0,
        custom=custom,
    )
    ctx.session.add(contact)
    await ctx.session.flush()
    await record_activity(
        ctx, "record_created", "contact", contact.id, {"name": full_name(contact)}
    )
    return await get_contact(ctx, contact.id)


async def update_contact(ctx: Ctx, contact_id: uuid.UUID, data: ContactUpdate) -> ContactOut:
    contact = await get_scoped(ctx, Contact, contact_id, "Contact")
    patch = data.model_dump(exclude_unset=True)
    before: dict[str, Any] = {k: getattr(contact, k) for k in _BUILTIN}
    before_custom = dict(contact.custom or {})
    if "owner_id" in patch:
        await ensure_member(ctx, patch["owner_id"])
    if "company_id" in patch:
        await _check_company(ctx, patch["company_id"])
    for key in _BUILTIN:
        if key in patch:
            value = patch[key]
            if key in ("first_name", "last_name") and isinstance(value, str):
                value = value.strip()
            if key == "email" and isinstance(value, str):
                value = value.strip().lower() or None
            setattr(contact, key, value)
    if patch.get("custom") is not None:
        contact.custom = await fields_service.validate_custom(
            ctx, "contact", patch["custom"], existing=contact.custom, partial=True
        )
    defs = await fields_service.list_definitions(ctx, "contact")
    labels = {**LABELS, **{d.key: d.label for d in defs}}
    changes = diff_changes(
        {**before, **before_custom},
        {**{k: getattr(contact, k) for k in _BUILTIN}, **(contact.custom or {})},
        labels,
    )
    await ctx.session.flush()
    if changes:
        changes = await humanize_changes(ctx, changes, defs)
        await record_activity(ctx, "field_updated", "contact", contact.id, {"changes": changes})
    if "title" in patch:
        await score_contacts(ctx, [contact])
    return await get_contact(ctx, contact.id)


async def delete_contact(ctx: Ctx, contact_id: uuid.UUID) -> None:
    contact = await get_scoped(ctx, Contact, contact_id, "Contact")
    await purge_related(ctx, "contact", contact.id)
    await ctx.session.delete(contact)
    await ctx.session.flush()


async def get_score(ctx: Ctx, contact_id: uuid.UUID) -> ScoreOut:
    breakdown = await score_contact(ctx, contact_id)
    return ScoreOut(
        contact_id=contact_id,
        score=breakdown.score,
        signals=[
            ScoreSignalOut(
                key=s.key, label=s.label, weight=s.weight, active=s.active, detail=s.detail
            )
            for s in breakdown.signals
        ],
    )
