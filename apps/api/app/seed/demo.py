"""Deterministic demo workspace: demo@halo.dev / demo1234."""

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Membership, User, Workspace
from app.onboarding.templates import TEMPLATES
from app.seed.builder import WorkspaceBuilder
from app.services.auth import hash_password

DEMO_EMAIL = "demo@halo.dev"
DEMO_PASSWORD = "demo1234"
DEMO_NAME = "Alex Morgan"
DEMO_SEED = 42
DEMO_USER_ID = uuid.uuid5(uuid.NAMESPACE_URL, "halo:demo-user")
DEMO_WORKSPACE_ID = uuid.uuid5(uuid.NAMESPACE_URL, "halo:demo-workspace")
DEMO_EMAIL_DOMAIN = "halo.dev"


async def reset_demo(session: AsyncSession) -> Workspace:
    """Drop and recreate the demo workspace. Idempotent: same ids and data every run."""
    teammate_ids = select(Membership.user_id).where(
        Membership.workspace_id == DEMO_WORKSPACE_ID, Membership.user_id != DEMO_USER_ID
    )
    teammates = list((await session.scalars(teammate_ids)).all())
    await session.execute(delete(Workspace).where(Workspace.id == DEMO_WORKSPACE_ID))
    if teammates:
        await session.execute(delete(User).where(User.id.in_(teammates)))
    await session.execute(
        delete(User).where((User.id == DEMO_USER_ID) | (User.email == DEMO_EMAIL))
    )
    await session.flush()

    password_hash = hash_password(DEMO_PASSWORD)
    user = User(id=DEMO_USER_ID, email=DEMO_EMAIL, password_hash=password_hash, full_name=DEMO_NAME)
    workspace = Workspace(
        id=DEMO_WORKSPACE_ID,
        name="Halo Demo",
        industry="b2b_saas",
        terminology={},
        onboarding_completed=False,
    )
    session.add_all([user, workspace])
    await session.flush()
    session.add(Membership(user_id=user.id, workspace_id=workspace.id, role="owner"))
    await session.flush()

    builder = WorkspaceBuilder(session, workspace, user, TEMPLATES["b2b_saas"], seed=DEMO_SEED)
    await builder.add_teammates(password_hash, DEMO_EMAIL_DOMAIN)
    await builder.build_all()
    return workspace
