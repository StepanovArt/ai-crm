import uuid
from typing import Literal

from pydantic import BaseModel

from app.agent.serialize import company_brief, contact_brief, deal_brief, task_brief
from app.agent.tools.base import Tool, ToolContext, ToolResult
from app.schemas.work import TaskFilter
from app.services import companies, contacts, deals, tasks
from app.services.listing import ListParams
from app.services.timeline import timeline


class GetRecordArgs(BaseModel):
    record_type: Literal["company", "contact", "deal"]
    record_id: uuid.UUID


class GetRecordTool(Tool[GetRecordArgs]):
    name = "get_record"
    label = "Reading the record"
    description = "Load a record with its recent activity and open tasks."
    Args = GetRecordArgs

    async def run(self, tctx: ToolContext, args: GetRecordArgs) -> ToolResult:
        ctx = tctx.ctx
        if args.record_type == "deal":
            record = deal_brief(await deals.get_deal(ctx, args.record_id))
        elif args.record_type == "contact":
            record = contact_brief(await contacts.get_contact(ctx, args.record_id))
        else:
            record = company_brief(await companies.get_company(ctx, args.record_id))
        acts = await timeline(ctx, args.record_type, args.record_id, limit=10)
        open_tasks, _ = await tasks.list_tasks(
            ctx,
            ListParams(limit=10),
            TaskFilter(related_type=args.record_type, related_id=args.record_id, done=False),
        )
        return ToolResult(
            ok=True,
            summary=f"Loaded {record['title']}",
            data={
                "record": record,
                "activities": [
                    {"type": a.type, "occurred_at": a.occurred_at.isoformat(), "payload": a.payload}
                    for a in acts
                ],
                "open_tasks": [task_brief(t) for t in open_tasks],
            },
        )
