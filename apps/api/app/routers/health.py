from fastapi import APIRouter

from app.config import get_settings
from app.schemas.common import OutModel

router = APIRouter(tags=["health"])


class HealthOut(OutModel):
    status: str
    app: str
    llm_provider: str


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    settings = get_settings()
    return HealthOut(status="ok", app=settings.app_name, llm_provider=settings.llm_provider)
