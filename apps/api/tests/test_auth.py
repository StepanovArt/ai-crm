from httpx import AsyncClient

from app.config import get_settings


async def test_login_sets_cookie_and_me_works(anon_client: AsyncClient) -> None:
    res = await anon_client.post(
        "/api/v1/auth/login", json={"email": "demo@halo.dev", "password": "demo1234"}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["user"]["email"] == "demo@halo.dev"
    assert body["workspace"]["terminology"]["deals"] == "Deals"
    cookie = res.cookies.get(get_settings().cookie_name)
    assert cookie
    assert "httponly" in res.headers["set-cookie"].lower()

    me = await anon_client.get("/api/v1/auth/me", cookies={get_settings().cookie_name: cookie})
    assert me.status_code == 200
    assert me.json()["user"]["full_name"] == "Alex Morgan"


async def test_login_wrong_password(anon_client: AsyncClient) -> None:
    res = await anon_client.post(
        "/api/v1/auth/login", json={"email": "demo@halo.dev", "password": "nope-nope"}
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "unauthorized"


async def test_me_requires_auth(anon_client: AsyncClient) -> None:
    res = await anon_client.get("/api/v1/auth/me")
    assert res.status_code == 401


async def test_signup_creates_workspace_pending_onboarding(anon_client: AsyncClient) -> None:
    res = await anon_client.post(
        "/api/v1/auth/signup",
        json={"email": "new.user@example.com", "password": "supersecret", "full_name": "Nina Park"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["workspace"]["name"] == "Nina's workspace"
    assert body["workspace"]["onboarding_completed"] is False
    assert body["role"] == "owner"


async def test_signup_duplicate_email(anon_client: AsyncClient) -> None:
    res = await anon_client.post(
        "/api/v1/auth/signup",
        json={"email": "DEMO@halo.dev", "password": "supersecret", "full_name": "Copy Cat"},
    )
    assert res.status_code == 409


async def test_signup_short_password(anon_client: AsyncClient) -> None:
    res = await anon_client.post(
        "/api/v1/auth/signup",
        json={"email": "short@example.com", "password": "123", "full_name": "Short"},
    )
    assert res.status_code == 422
    assert res.json()["error"]["code"] == "validation_error"


async def test_logout_clears_cookie(client: AsyncClient) -> None:
    res = await client.post("/api/v1/auth/logout")
    assert res.status_code == 200
    assert (
        'halo_session=""' in res.headers["set-cookie"] or "Max-Age=0" in res.headers["set-cookie"]
    )


async def test_tampered_token_rejected(anon_client: AsyncClient) -> None:
    res = await anon_client.get(
        "/api/v1/auth/me", cookies={get_settings().cookie_name: "not-a-real-token"}
    )
    assert res.status_code == 401
