from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.models import Contact
from app.seed.demo import DEMO_WORKSPACE_ID
from app.services import scoring
from app.services.activities import record_activity
from app.services.context import Ctx
from app.services.scoring import ActivityFact, compute_score

NOW = datetime(2026, 5, 20, 12, tzinfo=UTC)


def _fact(type: str, days_ago: float, **payload: object) -> ActivityFact:
    return ActivityFact(type, NOW - timedelta(days=days_ago), dict(payload))


def test_cold_contact_with_no_activity_is_zero() -> None:
    result = compute_score(title="Analyst", activities=[], has_open_deal=False, now=NOW)
    assert result.score == 0  # stale (-20) clamps to 0
    assert {s.key for s in result.signals if s.active} == {"stale_14d"}


def test_hot_contact_scores_all_positive_signals() -> None:
    facts = [
        _fact("email_received", 2),
        _fact("meeting", 1, scheduled_for=(NOW + timedelta(days=3)).isoformat()),
        _fact("email_sent", 5, opens=3),
    ]
    result = compute_score(title="VP of Sales", activities=facts, has_open_deal=True, now=NOW)
    assert result.score == 30 + 25 + 10 + 15 + 10
    assert [r.key for r in result.reasons][:2] == ["replied_recently", "meeting_scheduled"]


def test_old_reply_does_not_count_and_staleness_penalizes() -> None:
    facts = [_fact("email_received", 20)]
    result = compute_score(title="CEO", activities=facts, has_open_deal=True, now=NOW)
    active = {s.key for s in result.signals if s.active}
    assert active == {"deal_open", "title_is_decision_maker", "stale_14d"}
    assert result.score == 15 + 10 - 20


def test_single_open_is_not_multiple() -> None:
    result = compute_score(
        title=None, activities=[_fact("email_sent", 1, opens=1)], has_open_deal=False, now=NOW
    )
    assert not next(s for s in result.signals if s.key == "opened_multiple").active


def test_decision_maker_detection() -> None:
    assert scoring.is_decision_maker("Head of Revenue Operations")
    assert scoring.is_decision_maker("Founder & CEO")
    assert not scoring.is_decision_maker("Account Executive")


async def test_score_recomputes_when_activity_recorded(ctx: Ctx) -> None:
    contact = await ctx.session.scalar(
        select(Contact)
        .where(Contact.workspace_id == DEMO_WORKSPACE_ID, Contact.score == 0)
        .limit(1)
    )
    assert contact is not None
    await record_activity(ctx, "email_received", "contact", contact.id, {"subject": "Re: hi"})
    await ctx.session.refresh(contact)
    assert contact.score >= 30


async def test_seed_has_hot_leads(ctx: Ctx) -> None:
    hot = (
        await ctx.session.scalars(
            select(Contact).where(Contact.workspace_id == DEMO_WORKSPACE_ID, Contact.score >= 70)
        )
    ).all()
    assert len(hot) >= 5
