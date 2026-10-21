from httpx import AsyncClient

from tests.helpers import API, flt


async def test_board_totals(client: AsyncClient) -> None:
    pipeline = (await client.get(f"{API}/pipelines")).json()[0]
    board = (await client.get(f"{API}/pipelines/{pipeline['id']}/board")).json()
    assert [c["stage"]["name"] for c in board["columns"]][:2] == ["Lead", "Qualified"]
    assert sum(c["count"] for c in board["columns"]) == len(board["deals"]) == 25
    neg = next(c for c in board["columns"] if c["stage"]["name"] == "Negotiation")
    assert float(neg["weighted_value"]) == round(float(neg["total_value"]) * 0.8, 2)
    owner = board["deals"][0]["owner_id"]
    filtered = (
        await client.get(
            f"{API}/pipelines/{pipeline['id']}/board", params={"filter": flt(owner_id=owner)}
        )
    ).json()
    assert all(d["owner_id"] == owner for d in filtered["deals"])
    assert sum(c["count"] for c in filtered["columns"]) == len(filtered["deals"])


async def test_pipeline_and_stage_crud(client: AsyncClient) -> None:
    res = await client.post(f"{API}/pipelines", json={"name": "Partnerships"})
    assert res.status_code == 201
    pipeline = res.json()
    assert len(pipeline["stages"]) == 5
    stage = (
        await client.post(
            f"{API}/pipelines/{pipeline['id']}/stages", json={"name": "Pilot", "probability": 55}
        )
    ).json()
    refreshed = (await client.get(f"{API}/pipelines/{pipeline['id']}")).json()
    names = [s["name"] for s in refreshed["stages"]]
    assert names.index("Pilot") < names.index("Won")  # open stages go before closed ones

    renamed = await client.patch(
        f"{API}/stages/{stage['id']}", json={"name": "Paid pilot", "color": "teal"}
    )
    assert renamed.json()["name"] == "Paid pilot"

    reordered_ids = [s["id"] for s in reversed(refreshed["stages"])]
    reordered = await client.post(
        f"{API}/pipelines/{pipeline['id']}/stages/reorder", json={"stage_ids": reordered_ids}
    )
    assert [s["id"] for s in reordered.json()["stages"]] == reordered_ids

    assert (await client.delete(f"{API}/stages/{stage['id']}")).status_code == 200
    assert (await client.delete(f"{API}/pipelines/{pipeline['id']}")).status_code == 200


async def test_stage_with_deals_cannot_be_deleted(client: AsyncClient) -> None:
    pipeline = (await client.get(f"{API}/pipelines")).json()[0]
    res = await client.delete(f"{API}/stages/{pipeline['stages'][0]['id']}")
    assert res.status_code == 409
    bad_reorder = await client.post(
        f"{API}/pipelines/{pipeline['id']}/stages/reorder", json={"stage_ids": []}
    )
    assert bad_reorder.status_code == 422
