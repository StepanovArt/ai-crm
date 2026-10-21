"""Guards against N+1 queries: list endpoints must issue the same number of SQL statements
whatever the page size (related records are fetched in bulk, one query per related type)."""

from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime
from typing import Any

import pytest
from httpx import AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine

from tests.helpers import API


@contextmanager
def count_queries(engine: AsyncEngine) -> Iterator[list[str]]:
    statements: list[str] = []

    def before(_conn: Any, _cursor: Any, statement: str, *_: Any) -> None:
        if not statement.lstrip().upper().startswith(("SAVEPOINT", "RELEASE", "ROLLBACK")):
            statements.append(statement)

    event.listen(engine.sync_engine, "before_cursor_execute", before)
    try:
        yield statements
    finally:
        event.remove(engine.sync_engine, "before_cursor_execute", before)


async def _count(client: AsyncClient, engine: AsyncEngine, path: str, **params: Any) -> int:
    with count_queries(engine) as statements:
        res = await client.get(f"{API}/{path}", params=params)
        assert res.status_code == 200, res.text
    return len(statements)


@pytest.mark.parametrize(
    "path", ["companies", "contacts", "deals", "tasks", "pipelines/{pipeline}/board"]
)
async def test_list_queries_do_not_grow_with_page_size(
    client: AsyncClient, engine: AsyncEngine, path: str
) -> None:
    if "{pipeline}" in path:
        pipeline = (await client.get(f"{API}/pipelines")).json()[0]["id"]
        path = path.format(pipeline=pipeline)
        small = large = await _count(client, engine, path)
    else:
        small = await _count(client, engine, path, limit=50)
        large = await _count(client, engine, path, limit=200)
    assert small == large, f"{path}: {small} queries for 50 rows vs {large} for 200"
    assert large <= 14, f"{path} issued {large} queries"


async def test_today_and_timeline_are_bounded(client: AsyncClient, engine: AsyncEngine) -> None:
    # Today is several widgets, each built from bulk queries.
    assert await _count(client, engine, "dashboard/today") <= 32
    deal = (await client.get(f"{API}/deals", params={"limit": 1})).json()["items"][0]["id"]
    assert await _count(client, engine, "activities", related_type="deal", related_id=deal) <= 12


async def test_last_activity_rolls_up_from_linked_records(client: AsyncClient) -> None:
    """A company's last activity includes its contacts'; a contact's includes their deals'."""

    async def note(related_type: str, related_id: str) -> datetime:
        res = await client.post(
            f"{API}/notes",
            json={"related_type": related_type, "related_id": related_id, "body": "Ping"},
        )
        assert res.status_code == 201, res.text
        return datetime.fromisoformat(res.json()["created_at"])

    def last(record: dict[str, Any]) -> datetime:
        return datetime.fromisoformat(record["last_activity_at"])

    deal = (await client.get(f"{API}/deals", params={"limit": 1, "sort": "name"})).json()["items"][
        0
    ]
    contact_id = deal["primary_contact"]["id"]
    at = await note("deal", deal["id"])
    contact = (await client.get(f"{API}/contacts/{contact_id}")).json()
    assert last(contact) >= at

    at = await note("contact", contact_id)
    company = (await client.get(f"{API}/companies/{contact['company']['id']}")).json()
    assert last(company) >= at
