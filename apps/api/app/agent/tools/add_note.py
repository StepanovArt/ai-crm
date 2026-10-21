import uuid
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.agent.tools.base import Tool, ToolContext, ToolResult
from app.models import Deal
from app.schemas.work import NoteCreate
from app.services import notes as notes_service
from app.services import undo
from app.services.activities import collect_activities
from app.services.scoping import get_scoped


class AddNoteArgs(BaseModel):
    related_type: Literal["company", "contact", "deal"]
    related_id: uuid.UUID
    body: str = Field(min_length=1, max_length=20_000)


class AddNoteTool(Tool[AddNoteArgs]):
    name = "add_note"
    label = "Adding a note"
    description = "Add a note to a record's timeline."
    mutating = True
    Args = AddNoteArgs

    async def run(self, tctx: ToolContext, args: AddNoteArgs) -> ToolResult:
        ctx = tctx.ctx
        deal_snapshot = None
        if args.related_type == "deal":
            deal_snapshot = undo.snapshot_deal(await get_scoped(ctx, Deal, args.related_id, "Deal"))
        with collect_activities() as activity_ids:
            note, _ = await notes_service.create_note(
                ctx,
                NoteCreate(
                    related_type=args.related_type, related_id=args.related_id, body=args.body
                ),
            )
        return ToolResult(
            ok=True,
            summary="Note added",
            data={
                "note_id": str(note.id),
                "related_type": args.related_type,
                "related_id": str(args.related_id),
            },
            inverse_data={
                "note_id": str(note.id),
                "activity_ids": [str(a) for a in activity_ids],
                "deal_id": str(args.related_id) if deal_snapshot else None,
                "deal_snapshot": deal_snapshot,
            },
        )

    async def undo(self, tctx: ToolContext, inverse: dict[str, Any]) -> None:
        ctx = tctx.ctx
        await undo.delete_activities(ctx, [uuid.UUID(a) for a in inverse.get("activity_ids", [])])
        await undo.delete_note(ctx, uuid.UUID(inverse["note_id"]))
        if inverse.get("deal_id") and inverse.get("deal_snapshot"):
            await undo.restore_deal(ctx, uuid.UUID(inverse["deal_id"]), inverse["deal_snapshot"])
