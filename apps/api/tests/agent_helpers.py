import json
from typing import Any

from httpx import AsyncClient

from tests.helpers import API


async def sse(
    client: AsyncClient, path: str, body: dict[str, Any] | None = None
) -> list[dict[str, Any]]:
    """POST/GET an SSE endpoint and return the decoded AgentEvents."""
    if body is None:
        res = await client.get(f"{API}{path}")
    else:
        res = await client.post(f"{API}{path}", json=body)
    assert res.status_code == 200, res.text
    assert res.headers["content-type"].startswith("text/event-stream")
    events = []
    for line in res.text.splitlines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events


async def chat(client: AsyncClient, message: str, **context: Any) -> list[dict[str, Any]]:
    return await sse(
        client, "/agent/chat", {"message": message, "context": {"route": "/today", **context}}
    )


def types(events: list[dict[str, Any]]) -> list[str]:
    return [e["type"] for e in events]


def text(events: list[dict[str, Any]]) -> str:
    return "".join(e["text"] for e in events if e["type"] == "token")


def of(events: list[dict[str, Any]], kind: str) -> list[dict[str, Any]]:
    return [e for e in events if e["type"] == kind]


def ui(events: list[dict[str, Any]], kind: str | None = None) -> list[dict[str, Any]]:
    actions = [e["action"] for e in events if e["type"] == "ui_action"]
    return [a for a in actions if kind is None or a["kind"] == kind]


def assert_well_formed(events: list[dict[str, Any]]) -> None:
    assert events[0]["type"] == "message_start"
    assert events[-1]["type"] == "message_end"
    assert events[0]["message_id"] == events[-1]["message_id"]
    assert not of(events, "error"), of(events, "error")
    calls = {e["call_id"] for e in of(events, "tool_call")}
    results = {e["call_id"] for e in of(events, "tool_result")}
    assert calls == results
