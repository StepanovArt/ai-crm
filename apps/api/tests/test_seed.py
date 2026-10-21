from datetime import timedelta

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity, Company, Contact, Deal, Stage, Task
from app.models.base import utcnow
from app.seed.demo import DEMO_WORKSPACE_ID, reset_demo


async def _snapshot(session: AsyncSession) -> dict[str, object]:
    out: dict[str, object] = {}
    for model in (Company, Contact, Deal, Task, Activity):
        out[model.__tablename__] = await session.scalar(
            select(func.count()).select_from(model).where(model.workspace_id == DEMO_WORKSPACE_ID)
        )
    out["deal_names"] = sorted(
        (
            await session.scalars(select(Deal.name).where(Deal.workspace_id == DEMO_WORKSPACE_ID))
        ).all()
    )
    out["company_ids"] = sorted(
        str(i)
        for i in (
            await session.scalars(
                select(Company.id).where(Company.workspace_id == DEMO_WORKSPACE_ID)
            )
        ).all()
    )
    return out


async def test_seed_is_idempotent(session: AsyncSession) -> None:
    before = await _snapshot(session)
    await reset_demo(session)
    await session.flush()
    after = await _snapshot(session)
    assert before == after


async def test_seed_volumes_and_staleness(session: AsyncSession) -> None:
    snap = await _snapshot(session)
    assert snap["companies"] == 30
    assert snap["contacts"] == 60
    assert snap["deals"] == 25
    assert snap["tasks"] == 40
    assert isinstance(snap["activities"], int) and snap["activities"] >= 200
    week_ago = utcnow() - timedelta(days=7)
    stale = await session.scalar(
        select(func.count())
        .select_from(Deal)
        .join(Stage, Stage.id == Deal.stage_id)
        .where(
            Deal.workspace_id == DEMO_WORKSPACE_ID,
            Stage.kind == "open",
            Deal.last_activity_at < week_ago,
        )
    )
    assert stale is not None and stale >= 3


async def test_demo_reset_endpoint(client: AsyncClient) -> None:
    res = await client.post("/api/v1/demo/reset")
    assert res.status_code == 200
    me = await client.get("/api/v1/auth/me")
    assert me.status_code == 200  # same deterministic ids, session survives a reset
