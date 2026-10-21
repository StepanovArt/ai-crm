from httpx import AsyncClient

from tests.helpers import API, flt


async def test_list_search_sort_paginate(client: AsyncClient) -> None:
    res = await client.get(f"{API}/companies", params={"limit": 10, "sort": "name"})
    body = res.json()
    assert res.status_code == 200
    assert body["total"] == 30 and len(body["items"]) == 10 and body["next_cursor"] == "10"
    names = [c["name"] for c in body["items"]]
    assert names == sorted(names)
    page2 = (
        await client.get(f"{API}/companies", params={"limit": 10, "cursor": "10", "sort": "name"})
    ).json()
    assert page2["items"][0]["name"] > names[-1]

    acme = (await client.get(f"{API}/companies", params={"q": "acme"})).json()
    assert acme["total"] == 1 and acme["items"][0]["name"] == "Acme Analytics"
    assert acme["items"][0]["contacts_count"] >= 1


async def test_custom_filter_and_custom_sort(client: AsyncClient) -> None:
    res = await client.get(
        f"{API}/companies", params={"filter": flt(custom={"plan_tier": "enterprise"})}
    )
    assert res.status_code == 200
    assert all(c["custom"]["plan_tier"] == "enterprise" for c in res.json()["items"])
    sorted_res = (
        await client.get(f"{API}/companies", params={"sort": "-custom.arr", "limit": 5})
    ).json()
    arrs = [float(c["custom"]["arr"]) for c in sorted_res["items"] if "arr" in c["custom"]]
    assert arrs == sorted(arrs, reverse=True)


async def test_create_update_delete_company_writes_activities(client: AsyncClient) -> None:
    created = await client.post(
        f"{API}/companies",
        json={"name": "Lighthouse AI", "domain": "lighthouse.ai", "custom": {"employees": "120"}},
    )
    assert created.status_code == 201, created.text
    company = created.json()
    assert company["custom"] == {"employees": 120}

    updated = await client.patch(
        f"{API}/companies/{company['id']}",
        json={"industry": "AI", "custom": {"plan_tier": "growth"}},
    )
    assert updated.status_code == 200
    assert updated.json()["industry"] == "AI"

    timeline = (
        await client.get(
            f"{API}/activities", params={"related_type": "company", "related_id": company["id"]}
        )
    ).json()
    types = [a["type"] for a in timeline]
    assert types == ["field_updated", "record_created"]
    labels = {c["label"] for c in timeline[0]["payload"]["changes"]}
    assert labels == {"Industry", "Plan tier"}

    assert (await client.delete(f"{API}/companies/{company['id']}")).status_code == 200
    assert (await client.get(f"{API}/companies/{company['id']}")).status_code == 404


async def test_company_validation_errors(client: AsyncClient) -> None:
    bad_custom = await client.post(
        f"{API}/companies", json={"name": "X", "custom": {"plan_tier": "platinum"}}
    )
    assert bad_custom.status_code == 422
    assert bad_custom.json()["error"]["code"] == "validation_error"
    bad_filter = await client.get(f"{API}/companies", params={"filter": "{not json"})
    assert bad_filter.status_code == 422
    unknown_filter = await client.get(f"{API}/companies", params={"filter": flt(color="red")})
    assert unknown_filter.status_code == 422
    bad_sort = await client.get(f"{API}/companies", params={"sort": "password"})
    assert bad_sort.status_code == 422
