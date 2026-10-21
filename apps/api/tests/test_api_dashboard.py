from httpx import AsyncClient

from tests.helpers import API


async def test_today(client: AsyncClient) -> None:
    res = await client.get(f"{API}/dashboard/today")
    assert res.status_code == 200
    body = res.json()
    assert body["first_name"] == "Alex"
    assert body["tasks_overdue"] and body["tasks_today"]
    queue = body["contact_queue"]
    assert len(queue) == 8
    assert queue[0]["score"] >= queue[-1]["score"]
    assert queue[0]["reasons"] and queue[0]["reasons"][0]["active"]
    stats = body["stats"]
    assert stats["open_count"] >= 15 and float(stats["weighted_value"]) < float(stats["open_value"])
    assert stats["won_this_month_count"] >= 1
    assert body["stale_deals"] and len(body["stages"]) == 7


async def test_today_requires_auth(anon_client: AsyncClient) -> None:
    assert (await anon_client.get(f"{API}/dashboard/today")).status_code == 401
