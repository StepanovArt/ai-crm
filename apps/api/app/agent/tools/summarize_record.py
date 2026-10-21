import uuid
from typing import Literal

from pydantic import BaseModel

from app.agent.insights import build_insight
from app.agent.tools.base import Tool, ToolContext, ToolResult


class SummarizeArgs(BaseModel):
    record_type: Literal["company", "contact", "deal"]
    record_id: uuid.UUID


class SummarizeRecordTool(Tool[SummarizeArgs]):
    name = "summarize_record"
    label = "Summarizing the timeline"
    description = "Summarize a record's timeline and suggest the next step."
    Args = SummarizeArgs

    async def run(self, tctx: ToolContext, args: SummarizeArgs) -> ToolResult:
        insight = await build_insight(tctx.ctx, args.record_type, args.record_id)
        return ToolResult(ok=True, summary=insight.headline, data=insight.model_dump(mode="json"))
