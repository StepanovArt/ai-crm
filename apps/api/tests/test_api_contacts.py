from httpx import AsyncClient

from tests.helpers import API, first_id, flt


async def test_list_contacts_default_sort_by_score(client: AsyncClient) -> None:
    body = (await client.get(f"{API}/contacts", params={"limit": 20})).json()
    scores = [c["score"] for c in body["items"]]
    assert scores == sorted(scores, reverse=True)
    assert body["items"][0]["company"]["name"]
    assert body["items"][0]["full_name"]


async def test_hot_leads_filter(client: AsyncClient) -> None:
    body = (await client.get(f"{API}/contacts", params={"filter": flt(score_min=70)})).json()
    assert body["total"] >= 5
    assert all(c["score"] >= 70 for c in body["items"])


async def test_contact_crud_and_score_breakdown(client: AsyncClient) -> None:
    company_id = await first_id(client, "companies")
    res = await client.post(
        f"{API}/contacts",
        json={
            "first_name": "Ada",
            "last_name": "Lovelace",
            "title": "CTO",
            "company_id": company_id,
            "email": "ADA@Example.com",
            "custom": {"persona": "champion"},
        },
    )
    assert res.status_code == 201, res.text
    contact = res.json()
    assert contact["email"] == "ada@example.com"
    assert contact["company"]["id"] == company_id

    score = (await client.get(f"{API}/contacts/{contact['id']}/score")).json()
    keys = {s["key"]: s["active"] for s in score["signals"]}
    assert keys["title_is_decision_maker"] is True
    assert len(score["signals"]) == 6

    patched = await client.patch(
        f"{API}/contacts/{contact['id']}", json={"lead_status": "qualified"}
    )
    assert patched.status_code == 200 and patched.json()["lead_status"] == "qualified"
    assert (await client.delete(f"{API}/contacts/{contact['id']}")).status_code == 200


async def test_contact_errors(client: AsyncClient) -> None:
    missing = await client.get(f"{API}/contacts/00000000-0000-0000-0000-000000000000")
    assert missing.status_code == 404
    bad_company = await client.post(
        f"{API}/contacts",
        json={"first_name": "X", "company_id": "00000000-0000-0000-0000-000000000000"},
    )
    assert bad_company.status_code == 404
    bad_status = await client.post(
        f"{API}/contacts", json={"first_name": "X", "lead_status": "sleepy"}
    )
    assert bad_status.status_code == 422
