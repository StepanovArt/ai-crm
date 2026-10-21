from fastapi import APIRouter

from app.deps import CtxDep
from app.schemas.dashboard import TodayOut
from app.services import dashboard as service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/today", response_model=TodayOut)
async def get_today(ctx: CtxDep) -> TodayOut:
    return await service.today(ctx)
