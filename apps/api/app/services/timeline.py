import uuid
from datetime import datetime

from app.schemas.work import ActivityOut
from app.services.activities import RelatedType, list_timeline
from app.services.context import Ctx
from app.services.related import ensure_related, resolve


async def timeline(
    ctx: Ctx,
    related_type: RelatedType,
    related_id: uuid.UUID,
    *,
    limit: int = 50,
    before: datetime | None = None,
) -> list[ActivityOut]:
    await ensure_related(ctx, related_type, related_id)
    rows = await list_timeline(ctx, related_type, related_id, limit=limit, before=before)
    related = await resolve(ctx, ((a.related_type, a.related_id) for a in rows))
    out: list[ActivityOut] = []
    for a in rows:
        item = ActivityOut.model_validate(a)
        item.related = related.get((a.related_type, a.related_id))
        out.append(item)
    return out
