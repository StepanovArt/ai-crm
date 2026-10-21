import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from app.deps import CtxDep
from app.schemas.work import ActivityOut, RelatedType
from app.services.timeline import timeline

router = APIRouter(prefix="/activities", tags=["activities"])


@router.get("", response_model=list[ActivityOut])
async def list_activities(
    ctx: CtxDep,
    related_type: RelatedType,
    related_id: uuid.UUID,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    before: datetime | None = None,
) -> list[ActivityOut]:
    return await timeline(ctx, related_type, related_id, limit=limit, before=before)
