from httpx import AsyncClient

from app.config import get_settings
from tests.helpers import API, first_id


async def test_user_cannot_read_or_write_other_workspace(
    client: AsyncClient, anon_client: AsyncClient
) -> None:
    company_id = await first_id(client, "companies")
    deal_id = await first_id(client, "deals")
    signup = await anon_client.post(
        f"{API}/auth/signup",
        json={"email": "mallory@example.com", "password": "password123", "full_name": "Mallory"},
    )
    cookie = signup.cookies.get(get_settings().cookie_name)
    assert cookie
    other = {get_settings().cookie_name: cookie}
    assert (
        await anon_client.get(f"{API}/companies/{company_id}", cookies=other)
    ).status_code == 404
    assert (
        await anon_client.patch(f"{API}/deals/{deal_id}", json={"name": "pwned"}, cookies=other)
    ).status_code == 404
    listing = (await anon_client.get(f"{API}/companies", cookies=other)).json()
    assert listing["total"] == 0
    timeline = await anon_client.get(
        f"{API}/activities",
        params={"related_type": "company", "related_id": company_id},
        cookies=other,
    )
    assert timeline.status_code == 404
    note = await anon_client.post(
        f"{API}/notes",
        json={"related_type": "deal", "related_id": deal_id, "body": "hi"},
        cookies=other,
    )
    assert note.status_code == 404
