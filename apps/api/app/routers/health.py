from fastapi import APIRouter
from sqlalchemy import text

from app.config import get_settings
from app.deps import SessionMakerDep
from app.errors import ServiceUnavailableError
from app.schemas.common import OutModel

router = APIRouter(tags=["health"])


class HealthOut(OutModel):
    status: str
    app: str
    llm_provider: str


@router.get("/health", response_model=HealthOut)
async def health() -> HealthOut:
    """Liveness: the process is up (no dependencies checked)."""
    settings = get_settings()
    return HealthOut(status="ok", app=settings.app_name, llm_provider=settings.llm_provider)


@router.get("/health/ready", response_model=HealthOut)
async def ready(maker: SessionMakerDep) -> HealthOut:
    """Readiness: the database answers and migrations have run. 503 otherwise."""
    try:
        async with maker() as session:
            await session.execute(text("SELECT 1 FROM alembic_version"))
    except Exception as exc:
        raise ServiceUnavailableError("Database not ready") from exc
    settings = get_settings()
    return HealthOut(status="ready", app=settings.app_name, llm_provider=settings.llm_provider)
