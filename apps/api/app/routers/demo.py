from fastapi import APIRouter

from app.config import get_settings
from app.deps import SessionDep
from app.errors import NotFoundError
from app.schemas.common import OkOut
from app.seed.demo import reset_demo

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/reset", response_model=OkOut)
async def demo_reset(session: SessionDep) -> OkOut:
    """Re-create the demo workspace (dev/test only)."""
    if get_settings().env == "prod":
        raise NotFoundError("Not found")
    await reset_demo(session)
    return OkOut()
