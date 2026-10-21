import uuid
from collections.abc import Mapping
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field

from app.agent.matching import match_stage
from app.agent.serialize import company_brief, contact_brief, deal_brief, task_brief
from app.agent.tools.base import Tool, ToolContext, ToolResult
from app.models import Contact
from app.schemas.records import CompanyFilter, ContactFilter, DealFilter
from app.schemas.work import TaskFilter
from app.services import companies, contacts, deals, pipelines, tasks
from app.services.listing import ListParams
from app.services.scoping import scoped
from app.services.scoring import score_contacts


class SearchArgs(BaseModel):
    object_type: Literal["company", "contact", "deal", "task"]
    query: str | None = Field(default=None, description="Free-text name search")
    stage: str | None = Field(default=None, description="Stage name or id (deals)")
    status: Literal["open", "won", "lost"] | None = None
    owner_id: uuid.UUID | None = None
    value_min: Decimal | None = None
    value_max: Decimal | None = None
    stale_days: int | None = Field(
        default=None, ge=1, description="Open deals with no activity for N days"
    )
    score_min: int | None = Field(default=None, ge=0, le=100)
    task_bucket: Literal["overdue", "today", "upcoming", "open", "done"] | None = None
    assignee_id: uuid.UUID | None = None
    company_id: uuid.UUID | None = None
    mine: bool = Field(
        default=False, description="Only records owned by / tasks assigned to the user"
    )
    sort: str | None = None
    limit: int = Field(default=10, ge=1, le=50)


class SearchRecordsTool(Tool[SearchArgs]):
    name = "search_records"
    label = "Searching records"
    description = "Find companies, contacts, deals or tasks with filters (stage, owner, value, staleness, score)."
    Args = SearchArgs

    def describe(self, args: SearchArgs, terms: Mapping[str, str] | None = None) -> str:
        plural = {"company": "companies", "contact": "contacts", "deal": "deals", "task": "tasks"}[
            args.object_type
        ]
        noun = (terms or {}).get(plural, plural).lower()
        if args.stale_days:
            return f"Finding {noun} quiet for {args.stale_days}+ days"
        if args.score_min:
            return f"Finding {noun} scoring {args.score_min}+"
        if args.task_bucket:
            return {
                "overdue": "Checking overdue tasks",
                "today": "Checking tasks due today",
                "upcoming": "Checking upcoming tasks",
                "open": "Checking open tasks",
                "done": "Checking completed tasks",
            }[args.task_bucket]
        if args.query:
            return f"Searching {noun} for “{args.query}”"
        return f"Searching {noun}"

    async def run(self, tctx: ToolContext, args: SearchArgs) -> ToolResult:
        ctx = tctx.ctx
        params = ListParams(q=args.query, limit=args.limit, sort=args.sort)
        owner_id = ctx.user_id if args.mine else args.owner_id
        if args.object_type == "deal":
            stage_id: uuid.UUID | None = None
            if args.stage:
                options = [
                    (s.id, s.name) for p in await pipelines.list_pipelines(ctx) for s in p.stages
                ]
                try:
                    stage_id = uuid.UUID(args.stage)
                except ValueError:
                    stage_id = match_stage(args.stage, options)
            flt = DealFilter(
                stage_id=stage_id,
                status=args.status,
                owner_id=owner_id,
                value_min=args.value_min,
                value_max=args.value_max,
                stale_days=args.stale_days,
                company_id=args.company_id,
            )
            items, total = await deals.list_deals(ctx, params, flt)
            briefs = [deal_brief(d) for d in items]
        elif args.object_type == "contact":
            c_items, total = await contacts.list_contacts(
                ctx,
                params,
                ContactFilter(
                    owner_id=owner_id, score_min=args.score_min, company_id=args.company_id
                ),
            )
            briefs = [contact_brief(c) for c in c_items]
            orm = list(
                (
                    await ctx.session.scalars(
                        scoped(Contact, ctx.workspace_id).where(
                            Contact.id.in_([c.id for c in c_items])
                        )
                    )
                ).all()
            )
            breakdowns = await score_contacts(ctx, orm, persist=False)
            for b in briefs:
                bd = breakdowns.get(uuid.UUID(b["id"]))
                b["reasons"] = [
                    {"key": r.key, "label": r.label, "detail": r.detail}
                    for r in (bd.reasons if bd else [])
                    if r.weight > 0
                ][:3]
        elif args.object_type == "company":
            co_items, total = await companies.list_companies(
                ctx, params, CompanyFilter(owner_id=owner_id)
            )
            briefs = [company_brief(c) for c in co_items]
        else:
            t_items, total = await tasks.list_tasks(
                ctx,
                params,
                TaskFilter(
                    bucket=args.task_bucket,
                    assignee_id=ctx.user_id if args.mine else args.assignee_id,
                ),
            )
            briefs = [task_brief(t) for t in t_items]
        noun = (
            args.object_type
            if total == 1
            else {"company": "companies"}.get(args.object_type, args.object_type + "s")
        )
        return ToolResult(
            ok=True, summary=f"Found {total} {noun}", data={"items": briefs, "total": total}
        )
