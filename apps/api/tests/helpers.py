import json
from typing import Any

from httpx import AsyncClient

API = "/api/v1"


def flt(**kwargs: Any) -> str:
    return json.dumps(kwargs, default=str)


async def first_id(client: AsyncClient, path: str, **params: Any) -> str:
    res = await client.get(f"{API}/{path}", params={"limit": 1, **params})
    assert res.status_code == 200, res.text
    return str(res.json()["items"][0]["id"])


async def stages(client: AsyncClient) -> list[dict[str, Any]]:
    res = await client.get(f"{API}/pipelines")
    assert res.status_code == 200
    return list(res.json()[0]["stages"])
