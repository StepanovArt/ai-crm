import uuid
from collections.abc import Mapping
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.agent.serialize import company_brief, contact_brief, deal_brief
from app.agent.tools.base import Tool, ToolContext, ToolResult
from app.errors import ValidationFailed
from app.models import Company, Contact, Deal
from app.schemas.records import CompanyUpdate, ContactUpdate, DealUpdate
from app.services import companies, contacts, deals, undo
from app.services import fields as fields_service
from app.services.activities import collect_activities
from app.services.scoping import get_scoped

SYSTEM_FIELDS: dict[str, set[str]] = {
    "company": set(CompanyUpdate.model_fields) - {"custom"},
    "contact": set(ContactUpdate.model_fields) - {"custom"},
    "deal": set(DealUpdate.model_fields) - {"custom"},
}


class UpdateRecordArgs(BaseModel):
    record_type: Literal["company", "contact", "deal"]
    record_id: uuid.UUID
    fields: dict[str, Any] = Field(description="Field keys (system or custom) to new values")


class UpdateRecordTool(Tool[UpdateRecordArgs]):
    name = "update_record"
    label = "Updating the record"
    description = "Set fields on a company, contact or deal, including custom fields."
    mutating = True
    Args = UpdateRecordArgs

    def describe(self, args: UpdateRecordArgs, terms: Mapping[str, str] | None = None) -> str:
        return f"Updating {', '.join(args.fields)}"

    async def run(self, tctx: ToolContext, args: UpdateRecordArgs) -> ToolResult:
        ctx = tctx.ctx
        defs = {d.key for d in await fields_service.list_definitions(ctx, args.record_type)}
        system = {k: v for k, v in args.fields.items() if k in SYSTEM_FIELDS[args.record_type]}
        custom = {k: v for k, v in args.fields.items() if k in defs and k not in system}
        unknown = set(args.fields) - set(system) - set(custom)
        if unknown:
            raise ValidationFailed(f"Unknown field(s): {', '.join(sorted(unknown))}")
        payload: dict[str, Any] = {**system, **({"custom": custom} if custom else {})}
        with collect_activities() as activity_ids:
            if args.record_type == "deal":
                deal = await get_scoped(ctx, Deal, args.record_id, "Deal")
                snapshot = undo.snapshot_deal(deal)
                brief = deal_brief(
                    await deals.update_deal(ctx, deal.id, DealUpdate.model_validate(payload))
                )
            elif args.record_type == "contact":
                contact = await get_scoped(ctx, Contact, args.record_id, "Contact")
                snapshot = undo.snapshot_simple_record(contact, "contact")
                brief = contact_brief(
                    await contacts.update_contact(
                        ctx, contact.id, ContactUpdate.model_validate(payload)
                    )
                )
            else:
                company = await get_scoped(ctx, Company, args.record_id, "Company")
                snapshot = undo.snapshot_simple_record(company, "company")
                brief = company_brief(
                    await companies.update_company(
                        ctx, company.id, CompanyUpdate.model_validate(payload)
                    )
                )
        return ToolResult(
            ok=True,
            summary=f"Updated {brief['title']}",
            data={"record": brief, "fields": list(args.fields)},
            inverse_data={
                "record_type": args.record_type,
                "record_id": str(args.record_id),
                "snapshot": snapshot,
                "activity_ids": [str(a) for a in activity_ids],
            },
        )

    async def undo(self, tctx: ToolContext, inverse: dict[str, Any]) -> None:
        ctx = tctx.ctx
        await undo.delete_activities(ctx, [uuid.UUID(a) for a in inverse.get("activity_ids", [])])
        record_id = uuid.UUID(inverse["record_id"])
        if inverse["record_type"] == "deal":
            deal = await undo.restore_deal(ctx, record_id, inverse["snapshot"])
            await undo.rescore_deal_contact(ctx, deal)
        else:
            await undo.restore_simple_record(
                ctx, inverse["record_type"], record_id, inverse["snapshot"]
            )
