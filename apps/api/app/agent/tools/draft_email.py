import uuid

from pydantic import BaseModel

from app.agent.drafting import draft_follow_up
from app.agent.tools.base import Tool, ToolContext, ToolResult


class DraftEmailArgs(BaseModel):
    contact_id: uuid.UUID


class DraftEmailTool(Tool[DraftEmailArgs]):
    name = "draft_email"
    label = "Drafting an email"
    description = "Draft a follow-up email to a contact based on their history (not sent)."
    Args = DraftEmailArgs

    async def run(self, tctx: ToolContext, args: DraftEmailArgs) -> ToolResult:
        draft = await draft_follow_up(tctx.ctx, args.contact_id, tctx.timezone)
        return ToolResult(
            ok=True, summary=f"Draft ready: {draft.subject}", data=draft.model_dump(mode="json")
        )
