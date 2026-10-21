"""The OpenAI-compatible provider, driven by a scripted fake Chat Completions server."""

import json
import uuid
from typing import Any

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.agent.context import PageContext
from app.agent.orchestrator import AgentUser, Orchestrator
from app.agent.providers.openai_compat import OpenAICompatProvider
from app.agent.tools import default_registry
from app.agent.undo import undo_actions
from app.config import Settings
from app.models import Task
from app.seed.demo import DEMO_USER_ID, DEMO_WORKSPACE_ID
from tests.agent_helpers import of, text

USER = AgentUser(DEMO_USER_ID, DEMO_WORKSPACE_ID, "Alex Morgan", {"deals": "Deals"})


def _sse(*chunks: dict[str, Any]) -> bytes:
    body = "".join(f"data: {json.dumps(c)}\n\n" for c in chunks) + "data: [DONE]\n\n"
    return body.encode()


def _text(*pieces: str) -> bytes:
    return _sse(*({"choices": [{"delta": {"content": p}}]} for p in pieces))


def _tool_call(name: str, args: dict[str, Any], call_id: str = "call_1") -> bytes:
    raw = json.dumps(args)
    half = len(raw) // 2
    # Arguments arrive split across deltas, as real servers send them.
    return _sse(
        {
            "choices": [
                {
                    "delta": {
                        "tool_calls": [
                            {"index": 0, "id": call_id, "function": {"name": name, "arguments": ""}}
                        ]
                    }
                }
            ]
        },
        {
            "choices": [
                {"delta": {"tool_calls": [{"index": 0, "function": {"arguments": raw[:half]}}]}}
            ]
        },
        {
            "choices": [
                {"delta": {"tool_calls": [{"index": 0, "function": {"arguments": raw[half:]}}]}}
            ]
        },
    )


class FakeLLM:
    """Replays scripted streamed responses and records every request body."""

    def __init__(self, *responses: bytes) -> None:
        self.responses = list(responses)
        self.requests: list[dict[str, Any]] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/chat/completions")
        assert request.headers["authorization"] == "Bearer test-key"
        self.requests.append(json.loads(request.content))
        return httpx.Response(
            200, content=self.responses.pop(0), headers={"content-type": "text/event-stream"}
        )


def _orchestrator(maker: async_sessionmaker[AsyncSession], llm: FakeLLM) -> Orchestrator:
    settings = Settings(llm_provider="openai", openai_api_key="test-key", agent_delay_scale=0)
    provider = OpenAICompatProvider(settings, transport=httpx.MockTransport(llm.handler))
    return Orchestrator(maker, provider, default_registry())


async def test_read_tools_stream_text_and_cards(
    sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    llm = FakeLLM(
        _tool_call("pipeline_stats", {}),
        _text("Open pipeline is ", "**healthy**", "."),
    )
    orch = _orchestrator(sessionmaker, llm)
    events = [e.model_dump() async for e in orch.chat(USER, "How's the pipeline?", PageContext())]

    assert of(events, "tool_call")[0]["tool"] == "pipeline_stats"
    assert of(events, "tool_result")[0]["ok"] is True
    assert of(events, "card")[0]["kind"] == "chart"
    assert text(events) == "Open pipeline is **healthy**."
    assert events[-1]["type"] == "message_end"

    first, second = llm.requests
    names = {t["function"]["name"] for t in first["tools"]}
    assert {"search_records", "pipeline_stats", "propose_plan"} <= names
    # Mutating tools are only reachable through propose_plan.
    assert "create_task" not in names and "move_deal_stage" not in names
    assert first["stream"] is True and "Deals" in first["messages"][0]["content"]
    tool_msg = second["messages"][-1]
    assert tool_msg["role"] == "tool" and tool_msg["tool_call_id"] == "call_1"
    assert json.loads(tool_msg["content"])["ok"] is True


async def test_plan_is_proposed_approved_and_undone(
    sessionmaker: async_sessionmaker[AsyncSession], session: AsyncSession
) -> None:
    async def task_count() -> int:
        return int(
            await session.scalar(
                select(func.count()).select_from(Task).where(Task.workspace_id == DEMO_WORKSPACE_ID)
            )
            or 0
        )

    before = await task_count()
    plan_args = {
        "title": "Follow up with Acme",
        "summary": "Created the follow-up.",
        "steps": [
            {
                "label": "Create a follow-up task",
                "tool": "create_task",
                "args": {"tasks": [{"title": "Call Acme about renewal", "due_in_days": 1}]},
            }
        ],
    }
    llm = FakeLLM(_tool_call("propose_plan", plan_args))
    orch = _orchestrator(sessionmaker, llm)

    events = [
        e.model_dump() async for e in orch.chat(USER, "Remind me to call Acme", PageContext())
    ]
    plan = of(events, "plan")[0]
    assert plan["title"] == "Follow up with Acme"
    assert [s["tool"] for s in plan["steps"]] == ["create_task"]
    assert await task_count() == before  # nothing happens before approval

    run = [
        e.model_dump() async for e in orch.approve(USER, uuid.UUID(plan["plan_id"]), PageContext())
    ]
    assert of(run, "tool_result")[0]["ok"] is True
    assert "Created the follow-up." in text(run)
    assert await task_count() == before + 1

    undo_ids = [uuid.UUID(i) for i in run[-1]["undo_action_ids"]]
    await undo_actions(session, default_registry(), DEMO_WORKSPACE_ID, DEMO_USER_ID, undo_ids)
    assert await task_count() == before


async def test_invalid_plan_is_sent_back_to_the_model(
    sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    bad = {"title": "Oops", "steps": [{"label": "x", "tool": "search_records", "args": {}}]}
    llm = FakeLLM(_tool_call("propose_plan", bad), _text("Sorry, I can't do that."))
    orch = _orchestrator(sessionmaker, llm)
    events = [e.model_dump() async for e in orch.chat(USER, "Do something", PageContext())]
    assert not of(events, "plan")
    assert text(events) == "Sorry, I can't do that."
    feedback = json.loads(llm.requests[1]["messages"][-1]["content"])
    assert feedback["ok"] is False and "mutating" in feedback["error"]


async def test_missing_key_and_http_errors_fail_gracefully(
    sessionmaker: async_sessionmaker[AsyncSession],
) -> None:
    no_key = OpenAICompatProvider(Settings(llm_provider="openai", openai_api_key=None))
    orch = Orchestrator(sessionmaker, no_key, default_registry())
    events = [e.model_dump() async for e in orch.chat(USER, "Hi", PageContext())]
    assert "OPENAI_API_KEY" in text(events)

    def down(_: httpx.Request) -> httpx.Response:
        return httpx.Response(503, content=b"overloaded")

    settings = Settings(llm_provider="openai", openai_api_key="test-key", agent_delay_scale=0)
    flaky = OpenAICompatProvider(settings, transport=httpx.MockTransport(down))
    orch = Orchestrator(sessionmaker, flaky, default_registry())
    events = [e.model_dump() async for e in orch.chat(USER, "Hi", PageContext())]
    assert "HTTP 503" in text(events)
    assert events[-1]["type"] == "message_end"
