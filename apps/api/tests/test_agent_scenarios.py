"""Each required mock scenario (S1-S7) against the demo seed: events + DB effects."""

from typing import Any

from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Activity, AgentConversation, AgentMessage, Contact, Deal, Stage, Task
from app.seed.demo import DEMO_WORKSPACE_ID
from tests.agent_helpers import assert_well_formed, chat, of, sse, text, types, ui
from tests.helpers import API


async def _count(session: AsyncSession, model: Any, *where: Any) -> int:
    return int(
        await session.scalar(
            select(func.count())
            .select_from(model)
            .where(model.workspace_id == DEMO_WORKSPACE_ID, *where)
        )
        or 0
    )


# ---- S1 ---------------------------------------------------------------------------------------


async def test_s1_briefing(client: AsyncClient, session: AsyncSession) -> None:
    events = await chat(client, "What's on my plate today?")
    assert_well_formed(events)
    assert of(events, "thinking")
    tools = [e["tool"] for e in of(events, "tool_call")]
    assert tools.count("search_records") == 4
    assert not of(events, "plan")
    body = text(events)
    assert "tasks due today" in body or "No tasks due today" in body
    assert "hot lead" in body and "stale" in body
    card = of(events, "card")[0]
    assert card["kind"] == "records" and card["data"]["items"]
    assert events[-1]["suggestions"]
    # The conversation and both messages are persisted.
    conv_id = events[0]["conversation_id"]
    msgs = (
        await session.scalars(select(AgentMessage).where(AgentMessage.conversation_id == conv_id))
    ).all()
    assert [m.role for m in msgs] == ["user", "assistant"]
    assert msgs[1].content == body


# ---- S2 ---------------------------------------------------------------------------------------


async def _stale_deal_ids(session: AsyncSession) -> set[str]:
    from datetime import timedelta

    from app.models.base import utcnow

    rows = await session.scalars(
        select(Deal.id)
        .join(Stage, Stage.id == Deal.stage_id)
        .where(
            Deal.workspace_id == DEMO_WORKSPACE_ID,
            Stage.kind == "open",
            Deal.last_activity_at < utcnow() - timedelta(days=7),
        )
    )
    return {str(i) for i in rows.all()}


async def _snapshot(session: AsyncSession) -> dict[str, Any]:
    tasks = (
        await session.scalars(select(Task.id).where(Task.workspace_id == DEMO_WORKSPACE_ID))
    ).all()
    acts = (
        await session.scalars(select(Activity.id).where(Activity.workspace_id == DEMO_WORKSPACE_ID))
    ).all()
    deals = (
        await session.execute(
            select(
                Deal.id, Deal.stage_id, Deal.position, Deal.stage_entered_at, Deal.last_activity_at
            ).where(Deal.workspace_id == DEMO_WORKSPACE_ID)
        )
    ).all()
    scores = (
        await session.execute(
            select(Contact.id, Contact.score).where(Contact.workspace_id == DEMO_WORKSPACE_ID)
        )
    ).all()
    return {
        "tasks": set(tasks),
        "activities": set(acts),
        "deals": set(deals),
        "scores": set(scores),
    }


async def test_s2_stale_followups_plan_approve_undo(
    client: AsyncClient, session: AsyncSession
) -> None:
    stale = await _stale_deal_ids(session)
    assert len(stale) >= 3
    before = await _snapshot(session)

    events = await chat(client, "Find stale deals and create follow-ups")
    assert_well_formed(events)
    plan = of(events, "plan")[0]
    assert len(plan["steps"]) == len(stale)
    assert {s["tool"] for s in plan["steps"]} == {"create_task"}
    # Proposing must not change anything.
    assert await _count(session, Task) == len(before["tasks"])

    run = await sse(
        client, f"/agent/plans/{plan['plan_id']}/approve", {"context": {"route": "/today"}}
    )
    assert_well_formed(run)
    assert ui(run, "navigate")[0]["href"].startswith("/pipeline/")
    highlights = {a["target"] for a in ui(run, "highlight")}
    assert highlights == {f"deal-card-{d}" for d in stale}
    # Each deal is highlighted before its task is created.
    order = [
        (e["type"], e.get("action", {}).get("kind"))
        for e in run
        if e["type"] in ("ui_action", "tool_call")
    ]
    assert order.index(("ui_action", "highlight")) < order.index(("tool_call", None))
    assert ui(run, "invalidate") and ui(run, "toast")
    undo_ids = run[-1]["undo_action_ids"]
    assert len(undo_ids) == len(stale)

    agent_tasks = (
        await session.scalars(
            select(Task).where(Task.workspace_id == DEMO_WORKSPACE_ID, Task.created_by == "agent")
        )
    ).all()
    assert {str(t.related_id) for t in agent_tasks} == stale
    assert all(t.due_at is not None and not t.done for t in agent_tasks)
    assert await _count(
        session, Activity, Activity.actor_type == "agent", Activity.type == "task_created"
    ) == len(stale)

    res = await client.post(f"{API}/agent/actions/undo", json={"action_ids": undo_ids})
    assert res.status_code == 200
    body = res.json()
    assert sorted(body["undone_action_ids"]) == sorted(undo_ids)
    assert any(a["kind"] == "invalidate" for a in body["ui_actions"])
    session.expire_all()
    assert await _snapshot(session) == before

    # Undo is idempotent.
    again = await client.post(f"{API}/agent/actions/undo", json={"action_ids": undo_ids})
    assert again.json()["undone_action_ids"] == []


# ---- S3 ---------------------------------------------------------------------------------------


async def _acme(session: AsyncSession) -> Deal:
    deal = await session.scalar(
        select(Deal).where(Deal.workspace_id == DEMO_WORKSPACE_ID, Deal.name.like("Acme%"))
    )
    assert deal is not None
    return deal


async def test_s3_move_deal_plan_approve_undo(client: AsyncClient, session: AsyncSession) -> None:
    acme = await _acme(session)
    acme_id, original_stage = acme.id, acme.stage_id
    negotiation = await session.scalar(
        select(Stage).where(Stage.pipeline_id == acme.pipeline_id, Stage.name == "Negotiation")
    )
    assert negotiation is not None and acme.stage_id != negotiation.id
    negotiation_id = negotiation.id
    before = await _snapshot(session)

    events = await chat(client, "Move Acme to Negotiation")
    assert_well_formed(events)
    plan = of(events, "plan")[0]
    assert plan["steps"][0]["tool"] == "move_deal_stage"
    assert "Negotiation" in plan["title"] and "Acme" in plan["title"]
    session.expire_all()
    assert (await _acme(session)).stage_id == original_stage

    run = await sse(client, f"/agent/plans/{plan['plan_id']}/approve", {})
    assert_well_formed(run)
    moves = ui(run, "move_card")
    assert moves == [
        {"kind": "move_card", "deal_id": str(acme_id), "to_stage_id": str(negotiation_id)}
    ]
    session.expire_all()
    moved = await _acme(session)
    assert moved.stage_id == negotiation_id
    act = await session.scalar(
        select(Activity)
        .where(Activity.related_id == acme_id, Activity.type == "stage_changed")
        .order_by(Activity.occurred_at.desc())
        .limit(1)
    )
    assert (
        act is not None and act.actor_type == "agent" and act.payload["to_stage"] == "Negotiation"
    )
    deal_out = (await client.get(f"{API}/deals/{acme_id}")).json()
    assert deal_out["agent_touched_at"] is not None

    res = await client.post(
        f"{API}/agent/actions/undo", json={"action_ids": run[-1]["undo_action_ids"]}
    )
    assert res.status_code == 200
    back = [a for a in res.json()["ui_actions"] if a["kind"] == "move_card"]
    assert back and back[0]["to_stage_id"] == str(original_stage)
    session.expire_all()
    assert await _snapshot(session) == before


async def test_s3_fuzzy_names(client: AsyncClient, session: AsyncSession) -> None:
    acme = await _acme(session)
    events = await chat(client, "move akme analytics to negotation")
    plan = of(events, "plan")[0]
    assert "Negotiation" in plan["title"]
    tool_results = [e for e in of(events, "tool_result") if e["ok"]]
    assert tool_results
    assert str(acme.id) in str(of(events, "plan")) or "Acme" in plan["title"]


async def test_s3_unknown_stage_and_already_there(
    client: AsyncClient, session: AsyncSession
) -> None:
    events = await chat(client, "Move Acme to Hyperspace")
    assert not of(events, "plan") and "no stage called" in text(events)
    acme = await _acme(session)
    stage = await session.get(Stage, acme.stage_id)
    assert stage is not None
    events = await chat(client, f"Move Acme to {stage.name}")
    assert not of(events, "plan") and "already in" in text(events)


async def test_s3_on_record_page_uses_context(client: AsyncClient, session: AsyncSession) -> None:
    acme = await _acme(session)
    events = await chat(
        client,
        "move this to proposal",
        record_type="deal",
        record_id=str(acme.id),
        route=f"/records/deal/{acme.id}",
    )
    plan = of(events, "plan")[0]
    assert acme.name in plan["title"] and "Proposal" in plan["title"]


# ---- S4 ---------------------------------------------------------------------------------------


async def test_s4_draft_email_by_name(client: AsyncClient, session: AsyncSession) -> None:
    contact = await session.scalar(
        select(Contact)
        .where(Contact.workspace_id == DEMO_WORKSPACE_ID)
        .order_by(Contact.score.desc())
        .limit(1)
    )
    assert contact is not None
    events = await chat(
        client, f"Draft a follow-up email to {contact.first_name} {contact.last_name}"
    )
    assert_well_formed(events)
    card = of(events, "card")[0]
    assert card["kind"] == "email_draft"
    assert card["data"]["to_name"] == f"{contact.first_name} {contact.last_name}"
    assert card["data"]["body"].startswith(f"Hi {contact.first_name},")
    assert card["data"]["subject"]
    assert {e["tool"] for e in of(events, "tool_call")} >= {"get_record", "draft_email"}


async def test_s4_draft_email_on_record_page(client: AsyncClient, session: AsyncSession) -> None:
    contact = await session.scalar(
        select(Contact).where(Contact.workspace_id == DEMO_WORKSPACE_ID).limit(1)
    )
    assert contact is not None
    events = await chat(client, "draft email", record_type="contact", record_id=str(contact.id))
    card = of(events, "card")[0]
    assert card["data"]["contact_id"] == str(contact.id)
    assert card["data"]["related_type"] == "contact"


# ---- S5 ---------------------------------------------------------------------------------------


async def test_s5_pipeline_report(client: AsyncClient) -> None:
    events = await chat(client, "How's the pipeline this month?")
    assert_well_formed(events)
    assert [e["tool"] for e in of(events, "tool_call")] == ["pipeline_stats"]
    body = text(events)
    assert "weighted" in body and "$" in body
    chart = of(events, "card")[0]
    assert chart["kind"] == "chart"
    assert len(chart["data"]["series"]) == 7
    assert {"open_value", "weighted_value", "won_this_month_value"} <= set(chart["data"]["totals"])


# ---- S6 ---------------------------------------------------------------------------------------


async def test_s6_summarize_record(client: AsyncClient, session: AsyncSession) -> None:
    acme = await _acme(session)
    events = await chat(client, "Summarize this", record_type="deal", record_id=str(acme.id))
    assert_well_formed(events)
    assert [e["tool"] for e in of(events, "tool_call")] == ["summarize_record"]
    assert "Suggested next step" in text(events)
    card = of(events, "card")[0]
    assert card["kind"] == "next_step"
    assert card["data"]["related_id"] == str(acme.id)


async def test_s6_without_context_asks(client: AsyncClient) -> None:
    events = await chat(client, "summarize")
    assert "Open a record" in text(events)


# ---- S7 ---------------------------------------------------------------------------------------


async def test_s7_hot_leads(client: AsyncClient, session: AsyncSession) -> None:
    events = await chat(client, "Show me hot leads")
    assert_well_formed(events)
    seq = [a["kind"] for a in ui(events)]
    assert seq[:2] == ["navigate", "apply_filter"]
    assert ui(events, "navigate")[0]["href"] == "/contacts"
    assert ui(events, "apply_filter")[0] == {
        "kind": "apply_filter",
        "view": "contacts",
        "filter": {"score_min": 70},
    }
    highlights = [a["target"] for a in ui(events, "highlight")]
    assert len(highlights) == 3 and all(t.startswith("contact-row-") for t in highlights)
    top = (
        await session.scalars(
            select(Contact)
            .where(Contact.workspace_id == DEMO_WORKSPACE_ID)
            .order_by(Contact.score.desc())
            .limit(1)
        )
    ).first()
    assert top is not None and top.first_name in text(events)
    assert of(events, "card")[0]["kind"] == "records"


# ---- fallback, extras, guards ---------------------------------------------------------------


async def test_fallback_offers_four_prompts(client: AsyncClient) -> None:
    events = await chat(client, "What is the airspeed of an unladen swallow?")
    assert_well_formed(events)
    assert len(events[-1]["suggestions"]) == 4
    assert types(events).count("tool_call") == 0


async def test_create_task_plan(client: AsyncClient, session: AsyncSession) -> None:
    before = await _count(session, Task)
    events = await chat(client, "Remind me to call Aaron tomorrow")
    plan = of(events, "plan")[0]
    run = await sse(client, f"/agent/plans/{plan['plan_id']}/approve", {})
    assert_well_formed(run)
    assert await _count(session, Task) == before + 1
    task = await session.scalar(
        select(Task).where(Task.workspace_id == DEMO_WORKSPACE_ID, Task.title == "Call Aaron")
    )
    assert task is not None and task.created_by == "agent"


async def test_reject_plan_and_no_double_approve(client: AsyncClient) -> None:
    plan = of(await chat(client, "Move Acme to Negotiation"), "plan")[0]
    res = await client.post(f"{API}/agent/plans/{plan['plan_id']}/reject")
    assert res.status_code == 200
    again = await client.post(f"{API}/agent/plans/{plan['plan_id']}/approve", json={})
    assert again.status_code == 409


async def test_conversation_continues_and_lists(client: AsyncClient) -> None:
    first = await chat(client, "Show me hot leads")
    conv_id = first[0]["conversation_id"]
    second = await sse(
        client,
        "/agent/chat",
        {"conversation_id": conv_id, "message": "How's the pipeline this month?"},
    )
    assert second[0]["conversation_id"] == conv_id
    listing = (await client.get(f"{API}/agent/conversations")).json()
    assert listing[0]["id"] == conv_id
    detail = (await client.get(f"{API}/agent/conversations/{conv_id}")).json()
    assert [m["role"] for m in detail["messages"]] == ["user", "assistant", "user", "assistant"]
    assert any(e["type"] == "card" for e in detail["messages"][1]["events"])


async def test_other_user_cannot_touch_plan_or_conversation(
    client: AsyncClient, anon_client: AsyncClient, session: AsyncSession
) -> None:
    from app.config import get_settings

    events = await chat(client, "Move Acme to Negotiation")
    plan_id = of(events, "plan")[0]["plan_id"]
    conv_id = events[0]["conversation_id"]
    signup = await anon_client.post(
        f"{API}/auth/signup",
        json={"email": "eve@example.com", "password": "password123", "full_name": "Eve"},
    )
    other = {get_settings().cookie_name: signup.cookies[get_settings().cookie_name]}
    assert (
        await anon_client.post(f"{API}/agent/plans/{plan_id}/approve", json={}, cookies=other)
    ).status_code == 404
    assert (
        await anon_client.get(f"{API}/agent/conversations/{conv_id}", cookies=other)
    ).status_code == 404
    conv = await session.get(AgentConversation, conv_id)
    assert conv is not None
