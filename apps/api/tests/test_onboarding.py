from typing import Any

import pytest
from httpx import AsyncClient

from app.onboarding.generator import UNUSABLE_PASSWORD, match_template
from app.onboarding.templates import TEMPLATES
from app.services.auth import verify_password
from tests.agent_helpers import of, sse
from tests.helpers import API


async def _signup(client: AsyncClient, email: str) -> None:
    res = await client.post(
        f"{API}/auth/signup",
        json={"email": email, "password": "password123", "full_name": "Sam Rivera"},
    )
    assert res.status_code == 201, res.text
    assert res.json()["workspace"]["onboarding_completed"] is False


async def _total(client: AsyncClient, path: str) -> int:
    res = await client.get(f"{API}/{path}", params={"limit": 1})
    assert res.status_code == 200, res.text
    return int(res.json()["total"])


@pytest.mark.parametrize(
    ("description", "key"),
    [
        ("We sell apartments in new developments", "real_estate"),
        ("Boutique realtor for family homes", "real_estate"),
        ("We sell industrial equipment to factories", "industrial_equipment"),
        ("CNC machines and spare parts for manufacturers", "industrial_equipment"),
        ("We're a digital agency selling branding and web projects", "agency_services"),
        ("We're a recruitment agency placing software engineers", "recruitment"),
        ("Executive search for fintech", "recruitment"),
        ("We sell a B2B analytics platform to mid-market companies", "b2b_saas"),
        ("We make artisanal cheese", "b2b_saas"),
    ],
)
def test_match_template(description: str, key: str) -> None:
    assert match_template(description).template.key == key


def test_every_example_prompt_matches_its_own_template() -> None:
    for template in TEMPLATES.values():
        match = match_template(template.example_prompt)
        assert match.template.key == template.key
        assert match.matched


def test_templates_are_complete() -> None:
    assert set(TEMPLATES) == {
        "b2b_saas",
        "real_estate",
        "industrial_equipment",
        "agency_services",
        "recruitment",
    }
    for t in TEMPLATES.values():
        assert 5 <= len(t.stages) <= 7
        assert [s.kind for s in t.stages].count("won") == 1
        assert [s.kind for s in t.stages].count("lost") == 1
        for object_type in ("company", "contact", "deal"):
            assert 4 <= len(t.fields[object_type]) <= 8, (t.key, object_type)
        assert len(t.flavor.company_names) >= 30


async def test_templates_endpoint(anon_client: AsyncClient) -> None:
    res = await anon_client.get(f"{API}/onboarding/templates")
    assert res.status_code == 200
    body = res.json()
    assert len(body) == 5
    real_estate = next(t for t in body if t["key"] == "real_estate")
    assert real_estate["example_prompt"] == "We sell apartments in new developments"
    assert real_estate["terminology"]["deals"] == "Sales"


async def test_apartments_produce_a_real_estate_workspace(anon_client: AsyncClient) -> None:
    """Phase 8 DoD: a new user describing apartment sales gets a real-estate workspace."""
    await _signup(anon_client, "sam@harbourhomes.example")
    events = await sse(
        anon_client,
        "/onboarding/generate",
        {"description": "We sell apartments in new developments"},
    )
    kinds = [e["type"] for e in events]
    assert kinds[0] == "thinking" and kinds[-1] == "done", kinds
    assert "error" not in kinds
    template = of(events, "template")[0]
    assert template["key"] == "real_estate"
    assert "apartments" in template["matched"]
    steps = of(events, "step")
    outline = [s["id"] for s in template["steps"]]
    assert [s["id"] for s in steps if s["status"] == "done"] == outline
    # Every step announces itself before completing.
    for step_id in outline:
        statuses = [s["status"] for s in steps if s["id"] == step_id]
        assert statuses == ["running", "done"]
    done: dict[str, Any] = {s["id"]: s for s in steps if s["status"] == "done"}
    assert done["terminology"]["terminology"]["deals"] == "Sales"
    assert [s["name"] for s in done["pipeline"]["stages"]][:3] == ["Lead", "Viewing", "Offer"]
    assert any(f["label"] == "Budget" for f in done["fields"]["fields"])
    assert done["companies"]["count"] == 30 and len(done["companies"]["samples"]) == 6
    assert done["deals"]["deals"] and done["history"]["count"] > 100

    me = (await anon_client.get(f"{API}/auth/me")).json()
    ws = me["workspace"]
    assert ws["onboarding_completed"] is True and ws["industry"] == "real_estate"
    assert ws["terminology"]["deal"] == "Sale" and ws["terminology"]["contacts"] == "Buyers"

    pipelines = (await anon_client.get(f"{API}/pipelines")).json()
    assert len(pipelines) == 1
    assert [s["name"] for s in pipelines[0]["stages"]] == [
        "Lead",
        "Viewing",
        "Offer",
        "Reservation",
        "Contract",
        "Closed",
        "Lost",
    ]
    fields = (await anon_client.get(f"{API}/fields", params={"object_type": "deal"})).json()
    labels = {f["label"] for f in fields if not f["is_system"]}
    assert {"Property type", "Floor"} <= labels

    assert await _total(anon_client, "companies") == 30
    assert await _total(anon_client, "contacts") == 60
    assert await _total(anon_client, "deals") == 25
    households = (await anon_client.get(f"{API}/companies", params={"limit": 5})).json()["items"]
    assert all(h["domain"] is None for h in households)
    hot = await anon_client.get(f"{API}/contacts", params={"limit": 1, "sort": "-score"})
    assert hot.json()["items"][0]["score"] >= 70

    today = (await anon_client.get(f"{API}/dashboard/today")).json()
    assert today["contact_queue"] and (today["tasks_overdue"] or today["tasks_today"])

    again = await anon_client.post(f"{API}/onboarding/generate", json={"description": "Homes"})
    assert again.status_code == 409


async def test_skip_uses_the_demo_template(anon_client: AsyncClient) -> None:
    await _signup(anon_client, "kim@example.org")
    res = await anon_client.post(f"{API}/onboarding/demo", json={})
    assert res.status_code == 200, res.text
    ws = res.json()["workspace"]
    assert ws["onboarding_completed"] is True and ws["industry"] == "b2b_saas"
    assert await _total(anon_client, "deals") == 25
    assert (await anon_client.post(f"{API}/onboarding/demo", json={})).status_code == 409


async def test_two_new_workspaces_do_not_collide(anon_client: AsyncClient) -> None:
    """Teammates and seeded ids are per workspace, so onboarding twice never conflicts."""
    for email in ("one@example.org", "two@example.org"):
        anon_client.cookies.clear()
        await _signup(anon_client, email)
        res = await anon_client.post(f"{API}/onboarding/demo", json={"template": "recruitment"})
        assert res.status_code == 200, res.text
        assert res.json()["workspace"]["terminology"]["deals"] == "Searches"


async def test_onboarding_requires_auth(anon_client: AsyncClient) -> None:
    res = await anon_client.post(f"{API}/onboarding/generate", json={"description": "Homes"})
    assert res.status_code == 401
    assert verify_password(UNUSABLE_PASSWORD, "anything") is False
