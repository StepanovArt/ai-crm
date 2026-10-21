import uuid

from fastapi import APIRouter, status

from app.deps import CtxDep
from app.routers.params import FilterQuery, ListParamsDep
from app.schemas.common import OkOut, Page
from app.schemas.records import ContactCreate, ContactFilter, ContactOut, ContactUpdate, ScoreOut
from app.services import contacts as service
from app.services.listing import parse_filter

router = APIRouter(prefix="/contacts", tags=["contacts"])


@router.get("", response_model=Page[ContactOut])
async def list_contacts(
    ctx: CtxDep, params: ListParamsDep, filter: FilterQuery = None
) -> Page[ContactOut]:
    items, total = await service.list_contacts(ctx, params, parse_filter(filter, ContactFilter))
    return Page(items=items, total=total, next_cursor=params.next_cursor(total))


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def create_contact(body: ContactCreate, ctx: CtxDep) -> ContactOut:
    return await service.create_contact(ctx, body)


@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(contact_id: uuid.UUID, ctx: CtxDep) -> ContactOut:
    return await service.get_contact(ctx, contact_id)


@router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(contact_id: uuid.UUID, body: ContactUpdate, ctx: CtxDep) -> ContactOut:
    return await service.update_contact(ctx, contact_id, body)


@router.delete("/{contact_id}", response_model=OkOut)
async def delete_contact(contact_id: uuid.UUID, ctx: CtxDep) -> OkOut:
    await service.delete_contact(ctx, contact_id)
    return OkOut()


@router.get("/{contact_id}/score", response_model=ScoreOut)
async def get_contact_score(contact_id: uuid.UUID, ctx: CtxDep) -> ScoreOut:
    return await service.get_score(ctx, contact_id)
