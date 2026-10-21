import uuid
from typing import Any

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.agent.context import PageContext
from app.agent.orchestrator import MUTATION_NEEDS_PLAN, AgentUser, Orchestrator
from app.agent.providers.base import (
    ConversationState,
    ProviderRun,
    StoredPlan,
    TextStep,
    ToolCallStep,
)
from app.agent.tools import ToolContext, default_registry
from app.models import Activity, Company, Contact, Deal, Note
from app.seed.demo import DEMO_USER_ID, DEMO_WORKSPACE_ID
from app.services.context import Ctx
from tests.agent_helpers import assert_well_formed, of, sse, text
from tests.helpers import API


async def test_insights_for_each_record_type(client: AsyncClient, session: AsyncSession) -> None:
    deal = await session.scalar(select(Deal).where(Deal.workspace_id == DEMO_WORKSPACE_ID).limit(1))
    contact = await session.scalar(
        select(Contact).where(Contact.workspace_id == DEMO_WORKSPACE_ID).limit(1)
    )
    company = await session.scalar(
        select(Company).where(Company.workspace_id == DEMO_WORKSPACE_ID).limit(1)
    )
    assert deal and contact and company
    for rtype, rid in (("deal", deal.id), ("contact", contact.id), ("company", company.id)):
        res = await client.get(
            f"{API}/agent/insights", params={"record_type": rtype, "record_id": str(rid)}
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["headline"] and body["summary"] and body["bullets"]
        assert body["tone"] in ("positive", "neutral", "warning")
    missing = await client.get(
        f"{API}/agent/insights", params={"record_type": "deal", "record_id": str(uuid.uuid4())}
    )
    assert missing.status_code == 404


async def test_briefing_json_and_stream(client: AsyncClient) -> None:
    res = await client.get(f"{API}/agent/briefing", params={"timezone": "Europe/Berlin"})
    assert res.status_code == 200
    body = res.json()
    assert body["greeting"].endswith("Alex.")
    assert "Here's what matters today" in body["markdown"]
    assert {i["type"] for i in body["items"]} >= {"task", "contact", "deal"}

    events = await sse(client, "/agent/briefing/stream?timezone=UTC")
    assert_well_formed(events)
    assert events[0]["conversation_id"] is None
    assert "Here's what matters today" in text(events)
    assert of(events, "card")[0]["kind"] == "records"


async def test_events_schema_endpoint(client: AsyncClient) -> None:
    res = await client.get(f"{API}/agent/events/schema")
    assert res.status_code == 200 and res.json() == []
    spec = (await client.get("/openapi.json")).json()
    assert "TokenEvent" in spec["components"]["schemas"]


class _SneakyProvider:
    """Tries to mutate outside a plan — the orchestrator must refuse."""

    async def run(self, conv: ConversationState, ctx: PageContext, tools: Any) -> ProviderRun:
        out = yield ToolCallStep("create_task", {"tasks": [{"title": "Sneaky"}]})
        yield TextStep("ok" if out and out.ok else "refused")

    async def execute_plan(self, plan: StoredPlan, ctx: PageContext, tools: Any) -> ProviderRun:
        yield TextStep("")


async def test_mutations_require_an_approved_plan(
    sessionmaker: async_sessionmaker[AsyncSession], session: AsyncSession
) -> None:
    orch = Orchestrator(sessionmaker, _SneakyProvider(), default_registry())
    user = AgentUser(DEMO_USER_ID, DEMO_WORKSPACE_ID, "Alex Morgan", {})
    events = [e.model_dump() async for e in orch.chat(user, "do something sneaky", PageContext())]
    result = of(events, "tool_result")[0]
    assert result["ok"] is False and result["summary"] == MUTATION_NEEDS_PLAN
    assert text(events) == "refused"
    assert events[-1]["undo_action_ids"] is None


async def test_update_record_and_add_note_undo_exactly(session: AsyncSession) -> None:
    registry = default_registry()
    ctx = Ctx(
        session=session, workspace_id=DEMO_WORKSPACE_ID, user_id=DEMO_USER_ID, actor_type="agent"
    )
    tctx = ToolContext(ctx=ctx)
    deal = await session.scalar(select(Deal).where(Deal.workspace_id == DEMO_WORKSPACE_ID).limit(1))
    assert deal is not None
    deal_id = deal.id
    before = (deal.value, dict(deal.custom), deal.last_activity_at, deal.updated_at)
    n_acts = len(
        (await session.scalars(select(Activity.id).where(Activity.related_id == deal_id))).all()
    )

    update = registry.get("update_record")
    res = await update.run(
        tctx,
        update.parse(
            {
                "record_type": "deal",
                "record_id": str(deal_id),
                "fields": {"value": "123456", "seats": 77},
            }
        ),
    )
    assert res.ok
    await update.undo(tctx, update.inverse(res))

    note_tool = registry.get("add_note")
    res2 = await note_tool.run(
        tctx,
        note_tool.parse({"related_type": "deal", "related_id": str(deal_id), "body": "Agent note"}),
    )
    note_id = uuid.UUID(res2.data["note_id"])
    await note_tool.undo(tctx, note_tool.inverse(res2))

    session.expire_all()
    deal = await session.get(Deal, deal_id)
    assert deal is not None
    assert (deal.value, dict(deal.custom), deal.last_activity_at, deal.updated_at) == before
    assert (
        len(
            (await session.scalars(select(Activity.id).where(Activity.related_id == deal_id))).all()
        )
        == n_acts
    )
    assert await session.get(Note, note_id) is None


async def test_unknown_custom_field_fails_cleanly(session: AsyncSession) -> None:
    registry = default_registry()
    ctx = Ctx(
        session=session, workspace_id=DEMO_WORKSPACE_ID, user_id=DEMO_USER_ID, actor_type="agent"
    )
    tool = registry.get("update_record")
    deal = await session.scalar(select(Deal).where(Deal.workspace_id == DEMO_WORKSPACE_ID).limit(1))
    assert deal is not None
    from app.errors import ValidationFailed

    try:
        await tool.run(
            ToolContext(ctx=ctx),
            tool.parse({"record_type": "deal", "record_id": str(deal.id), "fields": {"warp": 9}}),
        )
    except ValidationFailed as exc:
        assert "warp" in exc.message
    else:
        raise AssertionError("expected ValidationFailed")


def test_tool_labels_use_workspace_vocabulary() -> None:
    tool = default_registry().get("search_records")
    stale = tool.parse({"object_type": "deal", "stale_days": 7})
    assert tool.describe(stale) == "Finding deals quiet for 7+ days"
    assert (
        tool.describe(stale, {"deals": "Opportunities"})
        == "Finding opportunities quiet for 7+ days"
    )
    query = tool.parse({"object_type": "company", "query": "Bergmann"})
    assert tool.describe(query, {"companies": "Customers"}) == "Searching customers for “Bergmann”"
