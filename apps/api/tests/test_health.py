from httpx import ASGITransport, AsyncClient

from app.main import app


async def test_health_ok() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


async def test_unknown_route_uses_error_envelope() -> None:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get("/api/v1/does-not-exist")
    assert res.status_code == 404
    assert res.json() == {"error": {"code": "not_found", "message": "Not Found"}}


async def test_ready_checks_the_database(anon_client: AsyncClient) -> None:
    res = await anon_client.get("/api/v1/health/ready")
    assert res.status_code == 200
    assert res.json()["status"] == "ready"


async def test_ready_is_503_when_the_database_is_down() -> None:
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    from app.deps import get_sessionmaker

    dead = create_async_engine("postgresql+asyncpg://nobody:x@127.0.0.1:1/none")
    app.dependency_overrides[get_sessionmaker] = lambda: async_sessionmaker(dead)
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
            res = await c.get("/api/v1/health/ready")
    finally:
        app.dependency_overrides.pop(get_sessionmaker, None)
        await dead.dispose()
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "unavailable"


def test_prod_refuses_the_dev_jwt_secret() -> None:
    import pytest
    from pydantic import ValidationError

    from app.config import Settings

    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(env="prod")
    with pytest.raises(ValidationError, match="JWT_SECRET"):
        Settings(env="prod", jwt_secret="short")
    assert Settings(env="prod", jwt_secret="x" * 40).env == "prod"
