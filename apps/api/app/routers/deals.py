import uuid

from fastapi import APIRouter, status

from app.deps import CtxDep
from app.routers.params import FilterQuery, ListParamsDep
from app.schemas.common import OkOut, Page
from app.schemas.records import DealCreate, DealFilter, DealMove, DealOut, DealUpdate
from app.services import deals as service
from app.services.listing import parse_filter

router = APIRouter(prefix="/deals", tags=["deals"])


@router.get("", response_model=Page[DealOut])
async def list_deals(
    ctx: CtxDep, params: ListParamsDep, filter: FilterQuery = None
) -> Page[DealOut]:
    items, total = await service.list_deals(ctx, params, parse_filter(filter, DealFilter))
    return Page(items=items, total=total, next_cursor=params.next_cursor(total))


@router.post("", response_model=DealOut, status_code=status.HTTP_201_CREATED)
async def create_deal(body: DealCreate, ctx: CtxDep) -> DealOut:
    return await service.create_deal(ctx, body)


@router.get("/{deal_id}", response_model=DealOut)
async def get_deal(deal_id: uuid.UUID, ctx: CtxDep) -> DealOut:
    return await service.get_deal(ctx, deal_id)


@router.patch("/{deal_id}", response_model=DealOut)
async def update_deal(deal_id: uuid.UUID, body: DealUpdate, ctx: CtxDep) -> DealOut:
    return await service.update_deal(ctx, deal_id, body)


@router.patch("/{deal_id}/move", response_model=DealOut)
async def move_deal(deal_id: uuid.UUID, body: DealMove, ctx: CtxDep) -> DealOut:
    return await service.move_deal(ctx, deal_id, body)


@router.delete("/{deal_id}", response_model=OkOut)
async def delete_deal(deal_id: uuid.UUID, ctx: CtxDep) -> OkOut:
    await service.delete_deal(ctx, deal_id)
    return OkOut()
