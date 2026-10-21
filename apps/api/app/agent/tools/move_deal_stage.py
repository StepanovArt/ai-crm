import uuid
from typing import Any

from pydantic import BaseModel, Field

from app.agent.serialize import deal_brief
from app.agent.tools.base import Tool, ToolContext, ToolResult
from app.models import Deal
from app.schemas.records import DealMove
from app.services import deals as deals_service
from app.services import undo
from app.services.activities import collect_activities
from app.services.scoping import get_scoped, get_stage


class MoveDealArgs(BaseModel):
    deal_id: uuid.UUID
    stage_id: uuid.UUID
    index: int | None = Field(
        default=0, ge=0, description="Position in the target column (0 = top)"
    )


class MoveDealStageTool(Tool[MoveDealArgs]):
    name = "move_deal_stage"
    label = "Moving the deal"
    description = "Move a deal to another stage of its pipeline (logs a stage change)."
    mutating = True
    Args = MoveDealArgs

    async def run(self, tctx: ToolContext, args: MoveDealArgs) -> ToolResult:
        ctx = tctx.ctx
        deal = await get_scoped(ctx, Deal, args.deal_id, "Deal")
        before = undo.snapshot_deal(deal)
        from_stage = await get_stage(ctx, deal.stage_id)
        with collect_activities() as activity_ids:
            moved = await deals_service.move_deal(
                ctx, deal.id, DealMove(stage_id=args.stage_id, index=args.index)
            )
        to_name = moved.stage.name if moved.stage else "the new stage"
        return ToolResult(
            ok=True,
            summary=f"Moved {moved.name} from {from_stage.name} to {to_name}",
            data={"deal": deal_brief(moved), "from_stage": from_stage.name, "to_stage": to_name},
            inverse_data={
                "deal_id": str(deal.id),
                "snapshot": before,
                "activity_ids": [str(a) for a in activity_ids],
            },
        )

    async def undo(self, tctx: ToolContext, inverse: dict[str, Any]) -> None:
        ctx = tctx.ctx
        await undo.delete_activities(ctx, [uuid.UUID(a) for a in inverse.get("activity_ids", [])])
        deal = await undo.restore_deal(ctx, uuid.UUID(inverse["deal_id"]), inverse["snapshot"])
        await undo.rescore_deal_contact(ctx, deal)
