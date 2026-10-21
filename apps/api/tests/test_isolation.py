import uuid

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import NotFoundError
from app.models import Company, Deal, Membership, User, Workspace
from app.seed.demo import DEMO_WORKSPACE_ID
from app.services.context import Ctx
from app.services.scoping import get_scoped, get_stage, scoped


async def _other_workspace(session: AsyncSession) -> Ctx:
    user = User(
        email=f"intruder-{uuid.uuid4().hex[:6]}@example.com", password_hash="x", full_name="Eve"
    )
    ws = Workspace(name="Other", industry="b2b_saas", terminology={}, onboarding_completed=True)
    session.add_all([user, ws])
    await session.flush()
    session.add(Membership(user_id=user.id, workspace_id=ws.id, role="owner"))
    await session.flush()
    return Ctx(session=session, workspace_id=ws.id, user_id=user.id)


async def test_scoped_query_hides_other_workspace_rows(session: AsyncSession) -> None:
    other = await _other_workspace(session)
    demo_company = await session.scalar(
        select(Company).where(Company.workspace_id == DEMO_WORKSPACE_ID).limit(1)
    )
    assert demo_company is not None

    rows = (await session.scalars(scoped(Company, other.workspace_id))).all()
    assert rows == []
    with pytest.raises(NotFoundError):
        await get_scoped(other, Company, demo_company.id, "Company")


async def test_stage_lookup_is_scoped_through_pipeline(session: AsyncSession) -> None:
    other = await _other_workspace(session)
    deal = await session.scalar(select(Deal).where(Deal.workspace_id == DEMO_WORKSPACE_ID).limit(1))
    assert deal is not None
    with pytest.raises(NotFoundError):
        await get_stage(other, deal.stage_id)
