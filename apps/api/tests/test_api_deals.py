from httpx import AsyncClient

from tests.helpers import API, first_id, flt, stages


async def test_list_filters(client: AsyncClient) -> None:
    open_deals = (
        await client.get(f"{API}/deals", params={"filter": flt(status="open"), "limit": 100})
    ).json()
    assert open_deals["total"] >= 15
    assert all(d["stage"]["kind"] == "open" for d in open_deals["items"])
    stale = (await client.get(f"{API}/deals", params={"filter": flt(stale_days=7)})).json()
    assert stale["total"] >= 3
    big = (
        await client.get(f"{API}/deals", params={"filter": flt(value_min=100000), "sort": "-value"})
    ).json()
    values = [float(d["value"]) for d in big["items"]]
    assert all(v >= 100000 for v in values) and values == sorted(values, reverse=True)
    acme = (await client.get(f"{API}/deals", params={"q": "acme"})).json()
    assert acme["total"] >= 1 and acme["items"][0]["company"]["name"] == "Acme Analytics"


async def test_money_is_decimal_string(client: AsyncClient) -> None:
    deal = (await client.get(f"{API}/deals", params={"limit": 1})).json()["items"][0]
    assert isinstance(deal["value"], str) and "." in deal["value"]


async def test_create_move_and_activity(client: AsyncClient) -> None:
    st = await stages(client)
    company_id = await first_id(client, "companies")
    res = await client.post(
        f"{API}/deals", json={"name": "New logo", "value": "12500.5", "company_id": company_id}
    )
    assert res.status_code == 201, res.text
    deal = res.json()
    assert deal["stage"]["name"] == st[0]["name"] and deal["value"] == "12500.50"

    target = next(s for s in st if s["name"] == "Negotiation")
    moved = await client.patch(
        f"{API}/deals/{deal['id']}/move", json={"stage_id": target["id"], "index": 0}
    )
    assert moved.status_code == 200
    assert moved.json()["stage_id"] == target["id"]
    column = (
        await client.get(
            f"{API}/deals", params={"filter": flt(stage_id=target["id"]), "sort": "position"}
        )
    ).json()["items"]
    assert column[0]["id"] == deal["id"]

    timeline = (
        await client.get(
            f"{API}/activities", params={"related_type": "deal", "related_id": deal["id"]}
        )
    ).json()
    assert timeline[0]["type"] == "stage_changed"
    assert timeline[0]["payload"]["to_stage"] == "Negotiation"


async def test_reorder_within_stage(client: AsyncClient) -> None:
    st = await stages(client)
    lead = st[0]["id"]
    column = (
        await client.get(f"{API}/deals", params={"filter": flt(stage_id=lead), "sort": "position"})
    ).json()["items"]
    assert len(column) >= 3
    last = column[-1]["id"]
    await client.patch(f"{API}/deals/{last}/move", json={"stage_id": lead, "index": 1})
    after = (
        await client.get(f"{API}/deals", params={"filter": flt(stage_id=lead), "sort": "position"})
    ).json()["items"]
    assert after[1]["id"] == last
    timeline = (
        await client.get(f"{API}/activities", params={"related_type": "deal", "related_id": last})
    ).json()
    assert timeline[0]["type"] != "stage_changed" or timeline[0]["payload"]["to_stage_id"] == lead


async def test_update_and_delete_deal(client: AsyncClient) -> None:
    deal_id = await first_id(client, "deals")
    res = await client.patch(
        f"{API}/deals/{deal_id}", json={"value": "99999", "custom": {"seats": 50}}
    )
    assert res.status_code == 200 and res.json()["value"] == "99999.00"
    assert (await client.delete(f"{API}/deals/{deal_id}")).status_code == 200
    assert (await client.get(f"{API}/deals/{deal_id}")).status_code == 404


async def test_deal_errors(client: AsyncClient) -> None:
    deal_id = await first_id(client, "deals")
    bad_stage = await client.patch(
        f"{API}/deals/{deal_id}/move", json={"stage_id": "00000000-0000-0000-0000-000000000000"}
    )
    assert bad_stage.status_code == 404
    negative = await client.post(f"{API}/deals", json={"name": "Neg", "value": "-5"})
    assert negative.status_code == 422
