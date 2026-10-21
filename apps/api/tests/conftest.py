import os

os.environ["ENV"] = "test"
os.environ["AGENT_DELAY_SCALE"] = "0"
_TEST_DB = os.environ.get(
    "TEST_DATABASE_URL", "postgresql+asyncpg://halo:halo@localhost:5432/halo_test"
)
os.environ["DATABASE_URL"] = _TEST_DB

import subprocess  # noqa: E402
import sys  # noqa: E402
from collections.abc import AsyncIterator  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from httpx import ASGITransport, AsyncClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.ext.asyncio import (  # noqa: E402
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.deps import get_sessionmaker  # noqa: E402
from app.main import app  # noqa: E402
from app.seed.demo import DEMO_USER_ID, DEMO_WORKSPACE_ID, reset_demo  # noqa: E402
from app.services.auth import create_token  # noqa: E402
from app.services.context import Ctx  # noqa: E402

API_DIR = Path(__file__).resolve().parents[1]


def _migrate_clean_db() -> None:
    import asyncio

    async def _drop() -> None:
        engine = create_async_engine(_TEST_DB, poolclass=NullPool)
        async with engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
        await engine.dispose()

    asyncio.run(_drop())
    subprocess.run(
        [sys.executable, "-m", "alembic", "-x", f"dburl={_TEST_DB}", "upgrade", "head"],
        cwd=API_DIR,
        check=True,
        capture_output=True,
    )


def pytest_sessionstart(session: pytest.Session) -> None:
    get_settings.cache_clear()
    _migrate_clean_db()


@pytest.fixture(scope="session")
async def engine() -> AsyncIterator[AsyncEngine]:
    eng = create_async_engine(_TEST_DB, poolclass=NullPool)
    maker = async_sessionmaker(eng, expire_on_commit=False)
    async with maker() as session:
        await reset_demo(session)
        await session.commit()
    yield eng
    await eng.dispose()


@pytest.fixture
async def sessionmaker(engine: AsyncEngine) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    """Each test runs inside an outer transaction that is rolled back afterwards."""
    async with engine.connect() as conn:
        trans = await conn.begin()
        maker = async_sessionmaker(
            bind=conn, expire_on_commit=False, join_transaction_mode="create_savepoint"
        )
        app.dependency_overrides[get_sessionmaker] = lambda: maker
        try:
            yield maker
        finally:
            app.dependency_overrides.pop(get_sessionmaker, None)
            await trans.rollback()


@pytest.fixture
async def session(sessionmaker: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncSession]:
    async with sessionmaker() as s:
        yield s


@pytest.fixture
def ctx(session: AsyncSession) -> Ctx:
    return Ctx(session=session, workspace_id=DEMO_WORKSPACE_ID, user_id=DEMO_USER_ID)


@pytest.fixture
async def anon_client(
    sessionmaker: async_sessionmaker[AsyncSession],
) -> AsyncIterator[AsyncClient]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def client(sessionmaker: async_sessionmaker[AsyncSession]) -> AsyncIterator[AsyncClient]:
    """Client signed in as the demo user."""
    token = create_token(DEMO_USER_ID, DEMO_WORKSPACE_ID)
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        cookies={get_settings().cookie_name: token},
    ) as c:
        yield c
