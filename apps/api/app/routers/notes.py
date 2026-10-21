import uuid

from fastapi import APIRouter, status

from app.deps import CtxDep
from app.routers.params import ListParamsDep
from app.schemas.common import OkOut, Page
from app.schemas.work import NoteCreate, NoteOut, NoteUpdate, RelatedType
from app.services import notes as service

router = APIRouter(prefix="/notes", tags=["notes"])


@router.get("", response_model=Page[NoteOut])
async def list_notes(
    ctx: CtxDep,
    params: ListParamsDep,
    related_type: RelatedType | None = None,
    related_id: uuid.UUID | None = None,
) -> Page[NoteOut]:
    items, total = await service.list_notes(ctx, params, related_type, related_id)
    return Page(
        items=[NoteOut.model_validate(n) for n in items],
        total=total,
        next_cursor=params.next_cursor(total),
    )


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(body: NoteCreate, ctx: CtxDep) -> NoteOut:
    note, _ = await service.create_note(ctx, body)
    return NoteOut.model_validate(note)


@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(note_id: uuid.UUID, body: NoteUpdate, ctx: CtxDep) -> NoteOut:
    return NoteOut.model_validate(await service.update_note(ctx, note_id, body))


@router.delete("/{note_id}", response_model=OkOut)
async def delete_note(note_id: uuid.UUID, ctx: CtxDep) -> OkOut:
    await service.delete_note(ctx, note_id)
    return OkOut()
