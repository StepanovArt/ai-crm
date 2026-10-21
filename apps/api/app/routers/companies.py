import uuid

from fastapi import APIRouter, status

from app.deps import CtxDep
from app.routers.params import FilterQuery, ListParamsDep
from app.schemas.common import OkOut, Page
from app.schemas.records import CompanyCreate, CompanyFilter, CompanyOut, CompanyUpdate
from app.services import companies as service
from app.services.listing import parse_filter

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("", response_model=Page[CompanyOut])
async def list_companies(
    ctx: CtxDep, params: ListParamsDep, filter: FilterQuery = None
) -> Page[CompanyOut]:
    items, total = await service.list_companies(ctx, params, parse_filter(filter, CompanyFilter))
    return Page(items=items, total=total, next_cursor=params.next_cursor(total))


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
async def create_company(body: CompanyCreate, ctx: CtxDep) -> CompanyOut:
    return await service.create_company(ctx, body)


@router.get("/{company_id}", response_model=CompanyOut)
async def get_company(company_id: uuid.UUID, ctx: CtxDep) -> CompanyOut:
    return await service.get_company(ctx, company_id)


@router.patch("/{company_id}", response_model=CompanyOut)
async def update_company(company_id: uuid.UUID, body: CompanyUpdate, ctx: CtxDep) -> CompanyOut:
    return await service.update_company(ctx, company_id, body)


@router.delete("/{company_id}", response_model=OkOut)
async def delete_company(company_id: uuid.UUID, ctx: CtxDep) -> OkOut:
    await service.delete_company(ctx, company_id)
    return OkOut()
