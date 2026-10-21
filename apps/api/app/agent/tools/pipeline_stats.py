import uuid
from decimal import Decimal

from pydantic import BaseModel

from app.agent.tools.base import Tool, ToolContext, ToolResult
from app.schemas.records import DealFilter
from app.services import dashboard, deals, pipelines


class PipelineStatsArgs(BaseModel):
    pipeline_id: uuid.UUID | None = None


class PipelineStatsTool(Tool[PipelineStatsArgs]):
    name = "pipeline_stats"
    label = "Crunching pipeline numbers"
    description = "Totals by stage, weighted value, and deals won this month."
    Args = PipelineStatsArgs

    async def run(self, tctx: ToolContext, args: PipelineStatsArgs) -> ToolResult:
        ctx = tctx.ctx
        stats, _ = await dashboard.pipeline_stats(ctx)
        pipeline_id = args.pipeline_id or stats.pipeline_id
        if pipeline_id is None:
            return ToolResult(ok=False, summary="No pipeline yet", data={})
        pipeline = await pipelines.get_pipeline(ctx, pipeline_id)
        totals = await deals.stage_totals(ctx, pipeline_id, DealFilter())
        zero = (0, Decimal(0), Decimal(0))
        stages = [
            {
                "id": str(s.id),
                "name": s.name,
                "color": s.color,
                "kind": s.kind,
                "probability": s.probability,
                "count": totals.get(s.id, zero)[0],
                "value": str(totals.get(s.id, zero)[1]),
                "weighted": str(totals.get(s.id, zero)[2]),
            }
            for s in pipeline.stages
        ]
        data = {
            "pipeline": {"id": str(pipeline.id), "name": pipeline.name},
            "currency": stats.currency,
            "open_count": stats.open_count,
            "open_value": str(stats.open_value),
            "weighted_value": str(stats.weighted_value),
            "won_this_month_count": stats.won_this_month_count,
            "won_this_month_value": str(stats.won_this_month_value),
            "stale_count": stats.stale_count,
            "stages": stages,
        }
        return ToolResult(
            ok=True, summary=f"{stats.open_count} open deals across {len(stages)} stages", data=data
        )
