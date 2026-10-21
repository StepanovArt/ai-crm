from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter(tags=["health"])


class HealthOut(BaseModel):
    status: str
    app: str
    llm_provider: str


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    settings = get_settings()
    return HealthOut(status="ok", app=settings.app_name, llm_provider=settings.llm_provider)
