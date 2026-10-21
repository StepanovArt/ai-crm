import uuid

from sqlalchemy import delete, func, select

from app.models import Activity, Note
from app.schemas.work import NoteCreate, NoteUpdate
from app.services.activities import record_activity
from app.services.context import Ctx
from app.services.listing import ListParams
from app.services.related import ensure_related
from app.services.scoping import get_scoped, scoped

EXCERPT = 140


async def list_notes(
    ctx: Ctx, params: ListParams, related_type: str | None, related_id: uuid.UUID | None
) -> tuple[list[Note], int]:
    stmt = scoped(Note, ctx.workspace_id)
    if related_type:
        stmt = stmt.where(Note.related_type == related_type)
    if related_id:
        stmt = stmt.where(Note.related_id == related_id)
    total = await ctx.session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    stmt = stmt.order_by(Note.created_at.desc()).offset(params.offset).limit(params.safe_limit)
    return list((await ctx.session.scalars(stmt)).all()), total


async def create_note(ctx: Ctx, data: NoteCreate) -> tuple[Note, Activity]:
    await ensure_related(ctx, data.related_type, data.related_id)
    note = Note(
        workspace_id=ctx.workspace_id,
        related_type=data.related_type,
        related_id=data.related_id,
        body=data.body.strip(),
        author_id=ctx.user_id,
        created_by="agent" if ctx.actor_type == "agent" else "user",
    )
    ctx.session.add(note)
    await ctx.session.flush()
    activity = await record_activity(
        ctx,
        "note",
        note.related_type,
        note.related_id,
        {"note_id": str(note.id), "excerpt": note.body[:EXCERPT]},
    )
    return note, activity


async def update_note(ctx: Ctx, note_id: uuid.UUID, data: NoteUpdate) -> Note:
    note = await get_scoped(ctx, Note, note_id, "Note")
    note.body = data.body.strip()
    activity = await ctx.session.scalar(
        scoped(Activity, ctx.workspace_id).where(
            Activity.type == "note", Activity.payload["note_id"].astext == str(note.id)
        )
    )
    if activity is not None:
        activity.payload = {**activity.payload, "excerpt": note.body[:EXCERPT], "edited": True}
    await ctx.session.flush()
    return note


async def delete_note(ctx: Ctx, note_id: uuid.UUID) -> None:
    note = await get_scoped(ctx, Note, note_id, "Note")
    await ctx.session.execute(
        delete(Activity).where(
            Activity.workspace_id == ctx.workspace_id,
            Activity.type == "note",
            Activity.payload["note_id"].astext == str(note.id),
        )
    )
    await ctx.session.delete(note)
    await ctx.session.flush()
