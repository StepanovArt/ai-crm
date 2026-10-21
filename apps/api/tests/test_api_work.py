from httpx import AsyncClient

from tests.helpers import API, first_id, flt


async def test_task_buckets(client: AsyncClient) -> None:
    overdue = (await client.get(f"{API}/tasks", params={"filter": flt(bucket="overdue")})).json()
    today = (await client.get(f"{API}/tasks", params={"filter": flt(bucket="today")})).json()
    done = (await client.get(f"{API}/tasks", params={"filter": flt(bucket="done")})).json()
    assert overdue["total"] >= 4 and today["total"] >= 4 and done["total"] >= 8
    assert all(t["related"] is not None for t in overdue["items"] if t["related_id"])


async def test_task_lifecycle_writes_activities(client: AsyncClient) -> None:
    deal_id = await first_id(client, "deals")
    res = await client.post(
        f"{API}/tasks",
        json={
            "title": "Call back",
            "related_type": "deal",
            "related_id": deal_id,
            "due_at": "2030-01-01T10:00:00Z",
        },
    )
    assert res.status_code == 201
    task = res.json()
    assert task["related"]["type"] == "deal" and task["created_by"] == "user"
    done = await client.patch(f"{API}/tasks/{task['id']}", json={"done": True})
    assert done.json()["done"] is True and done.json()["completed_at"]
    types = [
        a["type"]
        for a in (
            await client.get(
                f"{API}/activities", params={"related_type": "deal", "related_id": deal_id}
            )
        ).json()
    ]
    assert types[:2] == ["task_completed", "task_created"]
    assert (await client.delete(f"{API}/tasks/{task['id']}")).status_code == 200


async def test_task_errors(client: AsyncClient) -> None:
    half = await client.post(f"{API}/tasks", json={"title": "x", "related_type": "deal"})
    assert half.status_code == 422
    missing = await client.patch(
        f"{API}/tasks/00000000-0000-0000-0000-000000000000", json={"done": True}
    )
    assert missing.status_code == 404


async def test_notes_crud_syncs_timeline(client: AsyncClient) -> None:
    contact_id = await first_id(client, "contacts")
    res = await client.post(
        f"{API}/notes",
        json={"related_type": "contact", "related_id": contact_id, "body": "Prefers email."},
    )
    assert res.status_code == 201
    note = res.json()
    listed = (
        await client.get(
            f"{API}/notes", params={"related_type": "contact", "related_id": contact_id}
        )
    ).json()
    assert listed["items"][0]["id"] == note["id"]
    await client.patch(f"{API}/notes/{note['id']}", json={"body": "Prefers phone."})
    timeline = (
        await client.get(
            f"{API}/activities", params={"related_type": "contact", "related_id": contact_id}
        )
    ).json()
    note_act = next(a for a in timeline if a["type"] == "note")
    assert note_act["payload"]["excerpt"] == "Prefers phone."
    await client.delete(f"{API}/notes/{note['id']}")
    timeline = (
        await client.get(
            f"{API}/activities", params={"related_type": "contact", "related_id": contact_id}
        )
    ).json()
    assert all(a["payload"].get("note_id") != note["id"] for a in timeline)


async def test_note_requires_body_and_existing_record(client: AsyncClient) -> None:
    empty = await client.post(
        f"{API}/notes",
        json={
            "related_type": "contact",
            "related_id": "00000000-0000-0000-0000-000000000000",
            "body": "",
        },
    )
    assert empty.status_code == 422
    missing = await client.post(
        f"{API}/notes",
        json={
            "related_type": "contact",
            "related_id": "00000000-0000-0000-0000-000000000000",
            "body": "hi",
        },
    )
    assert missing.status_code == 404


async def test_company_timeline_includes_contacts_and_deals(client: AsyncClient) -> None:
    company_id = (await client.get(f"{API}/companies", params={"q": "acme"})).json()["items"][0][
        "id"
    ]
    timeline = (
        await client.get(
            f"{API}/activities", params={"related_type": "company", "related_id": company_id}
        )
    ).json()
    assert {a["related_type"] for a in timeline} >= {"contact", "deal"}
    assert all(a["related"]["name"] for a in timeline)
    bad = await client.get(
        f"{API}/activities", params={"related_type": "planet", "related_id": company_id}
    )
    assert bad.status_code == 422
