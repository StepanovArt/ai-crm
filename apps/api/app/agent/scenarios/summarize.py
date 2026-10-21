"""S6 — "Summarize this" on a record page: summarize_record → bullets + next step card."""

from typing import Any

from app.agent.providers.base import SuggestionsStep, ToolCallStep
from app.agent.scenarios.common import ScenarioGen, items, need
from app.agent.scenarios.kit import Kit

_FILLER = (
    "summarize",
    "summarise",
    "summary of",
    "summary",
    "recap",
    "catch me up on",
    "tl;dr",
    "this",
    "the",
    "please",
)


async def run(kit: Kit) -> ScenarioGen:
    ctx = kit.ctx
    target: tuple[str, str] | None = None
    if ctx.record_type and ctx.record_id:
        target = (ctx.record_type, str(ctx.record_id))
    else:
        query = kit.message.lower()
        for word in _FILLER:
            query = query.replace(word, " ")
        query = " ".join(query.split()).strip(" ?.!")
        if query:
            for object_type in ("deal", "company", "contact"):
                found = need(
                    (
                        yield ToolCallStep(
                            "search_records",
                            {"object_type": object_type, "query": query, "limit": 1},
                        )
                    )
                )
                if items(found):
                    target = (object_type, items(found)[0]["id"])
                    break
    if target is None:
        async for s in kit.say(
            "Open a record and ask again — or tell me which one, e.g. *Summarize Acme*."
        ):
            yield s
        return

    async for s in kit.think("Reading the timeline"):
        yield s
    out = need(
        (yield ToolCallStep("summarize_record", {"record_type": target[0], "record_id": target[1]}))
    )
    insight: dict[str, Any] = out.data
    bullets = "\n".join(f"- {b}" for b in insight.get("bullets", []))
    step = insight.get("next_step")
    text = f"**{insight['headline']}**\n\n{insight['summary']}\n\n{bullets}"
    if step:
        text += f"\n\n**Suggested next step:** {step['title']} — {step['reason'].lower()}."
    async for s in kit.say(text):
        yield s
    if step:
        async for s in kit.card("next_step", step):
            yield s
    yield SuggestionsStep(
        ["Draft a follow-up email"]
        if target[0] in ("contact", "deal")
        else ["What's on my plate today?"]
    )
