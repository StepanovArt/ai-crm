"""S4 — "Draft a follow-up email to {contact}" (or "draft email" on a record page)."""

from app.agent.matching import best_matches
from app.agent.providers.base import SuggestionsStep, ToolCallStep
from app.agent.scenarios.common import ScenarioGen, first_word, items, need
from app.agent.scenarios.kit import Kit
from app.agent.scenarios.parse import parse_recipient


async def run(kit: Kit) -> ScenarioGen:
    contact_id: str | None = None
    ctx = kit.ctx
    name = parse_recipient(kit.message)
    if name is None and ctx.record_type == "contact" and ctx.record_id:
        contact_id = str(ctx.record_id)
    elif name is None and ctx.record_type == "deal" and ctx.record_id:
        got = need(
            (
                yield ToolCallStep(
                    "get_record", {"record_type": "deal", "record_id": str(ctx.record_id)}
                )
            )
        )
        contact = (got.data.get("record") or {}).get("contact")
        contact_id = contact["id"] if contact else None
    elif name is None and ctx.record_type == "company" and ctx.record_id:
        found = need(
            (
                yield ToolCallStep(
                    "search_records",
                    {
                        "object_type": "contact",
                        "company_id": str(ctx.record_id),
                        "sort": "-score",
                        "limit": 1,
                    },
                )
            )
        )
        contact_id = items(found)[0]["id"] if items(found) else None
    elif name is not None:
        async for s in kit.think(f"Looking for {name}"):
            yield s
        found = need(
            (
                yield ToolCallStep(
                    "search_records", {"object_type": "contact", "query": name, "limit": 5}
                )
            )
        )
        candidates = items(found)
        if not candidates:
            wide = need(
                (
                    yield ToolCallStep(
                        "search_records", {"object_type": "contact", "limit": 50, "sort": "-score"}
                    )
                )
            )
            candidates = [
                c
                for c, _ in best_matches(
                    name, [(c, c["title"]) for c in items(wide)], threshold=0.6
                )
            ]
        contact_id = candidates[0]["id"] if candidates else None

    if contact_id is None:
        hot = need(
            (
                yield ToolCallStep(
                    "search_records",
                    {"object_type": "contact", "score_min": 60, "sort": "-score", "limit": 3},
                )
            )
        )
        async for s in kit.say("Who should I write to? Here are a few people worth a follow-up:"):
            yield s
        yield SuggestionsStep([f"Draft a follow-up email to {c['title']}" for c in items(hot)])
        return

    record = need(
        (yield ToolCallStep("get_record", {"record_type": "contact", "record_id": contact_id}))
    )
    person = record.data.get("record") or {}
    async for s in kit.think(
        f"Reading the history with {first_word(person.get('title')) or 'them'}"
    ):
        yield s
    draft = need((yield ToolCallStep("draft_email", {"contact_id": contact_id})))
    if not draft.ok:
        async for s in kit.say("I couldn't put a draft together for that contact."):
            yield s
        return
    company = (person.get("company") or {}).get("name")
    at = f" at {company}" if company else ""
    async for s in kit.say(
        f"Here's a follow-up for **{person.get('title', 'them')}**{at}. {draft.data.get('context_note', '')} "
        "Copy it into your email client, or save it to the timeline as a note."
    ):
        yield s
    async for s in kit.card("email_draft", draft.data):
        yield s
    yield SuggestionsStep(["Summarize this", "What's on my plate today?"])
