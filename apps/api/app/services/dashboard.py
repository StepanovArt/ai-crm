from datetime import timedelta
from decimal import Decimal

from sqlalchemy import func, or_, select

from app.errors import NotFoundError
from app.models import Contact, Deal, Stage, Task, User
from app.models.base import utcnow
from app.schemas.dashboard import PipelineStats, QueueItem, StageStat, TodayOut
from app.schemas.records import DealFilter, ScoreSignalOut
from app.services import contacts as contacts_service
from app.services import deals as deals_service
from app.services import tasks as tasks_service
from app.services.context import Ctx
from app.services.scoping import scoped
from app.services.scoring import score_contacts

STALE_DAYS = 7
QUEUE_SIZE = 8


async def pipeline_stats(ctx: Ctx) -> tuple[PipelineStats, list[StageStat]]:
    try:
        pipeline = await deals_service.default_pipeline(ctx)
    except NotFoundError:
        empty = PipelineStats(
            pipeline_id=None,
            open_count=0,
            open_value=Decimal("0"),
            weighted_value=Decimal("0"),
            won_this_month_count=0,
            won_this_month_value=Decimal("0"),
            stale_count=0,
            currency="USD",
        )
        return empty, []
    totals = await deals_service.stage_totals(ctx, pipeline.id, DealFilter())
    stages = list(
        (
            await ctx.session.scalars(
                select(Stage).where(Stage.pipeline_id == pipeline.id).order_by(Stage.position)
            )
        ).all()
    )
    now = utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    won = (
        await ctx.session.execute(
            select(func.count(), func.coalesce(func.sum(Deal.value), 0))
            .join(Stage, Stage.id == Deal.stage_id)
            .where(
                Deal.workspace_id == ctx.workspace_id,
                Deal.pipeline_id == pipeline.id,
                Stage.kind == "won",
                Deal.stage_entered_at >= month_start,
            )
        )
    ).one()
    cutoff = now - timedelta(days=STALE_DAYS)
    stale = await ctx.session.scalar(
        select(func.count())
        .select_from(Deal)
        .join(Stage, Stage.id == Deal.stage_id)
        .where(
            Deal.workspace_id == ctx.workspace_id,
            Deal.pipeline_id == pipeline.id,
            Stage.kind == "open",
            or_(Deal.last_activity_at.is_(None), Deal.last_activity_at < cutoff),
        )
    )
    currency = await ctx.session.scalar(
        select(Deal.currency).where(Deal.workspace_id == ctx.workspace_id).limit(1)
    )
    open_stages = [s for s in stages if s.kind == "open"]
    stats = PipelineStats(
        pipeline_id=pipeline.id,
        open_count=sum(totals.get(s.id, (0, Decimal(0), Decimal(0)))[0] for s in open_stages),
        open_value=sum(
            (totals.get(s.id, (0, Decimal(0), Decimal(0)))[1] for s in open_stages), Decimal(0)
        ),
        weighted_value=sum(
            (totals.get(s.id, (0, Decimal(0), Decimal(0)))[2] for s in open_stages), Decimal(0)
        ),
        won_this_month_count=int(won[0]),
        won_this_month_value=Decimal(won[1]),
        stale_count=int(stale or 0),
        currency=currency or "USD",
    )
    stage_stats = [
        StageStat(
            stage_id=s.id,
            name=s.name,
            color=s.color,
            kind=s.kind,
            count=totals.get(s.id, (0, Decimal(0), Decimal(0)))[0],
            value=totals.get(s.id, (0, Decimal(0), Decimal(0)))[1],
        )
        for s in stages
    ]
    return stats, stage_stats


async def contact_queue(ctx: Ctx, size: int = QUEUE_SIZE) -> list[QueueItem]:
    candidates = list(
        (
            await ctx.session.scalars(
                scoped(Contact, ctx.workspace_id)
                .where(Contact.score > 0)
                .order_by(Contact.score.desc(), Contact.last_name)
                .limit(size)
            )
        ).all()
    )
    if not candidates:
        return []
    breakdowns = await score_contacts(ctx, candidates)
    enriched = {c.id: c for c in await contacts_service.enrich(ctx, candidates)}
    open_deals = await deals_service.list_all_deals(ctx, DealFilter(status="open"))
    deal_by_contact = {d.primary_contact_id: d for d in open_deals if d.primary_contact_id}
    items = []
    for c in sorted(candidates, key=lambda x: -breakdowns[x.id].score):
        b = breakdowns[c.id]
        items.append(
            QueueItem(
                contact=enriched[c.id],
                score=b.score,
                reasons=[
                    ScoreSignalOut(
                        key=s.key, label=s.label, weight=s.weight, active=s.active, detail=s.detail
                    )
                    for s in b.reasons
                ],
                open_deal=deal_by_contact.get(c.id),
            )
        )
    return items


async def today(ctx: Ctx) -> TodayOut:
    user = await ctx.session.get(User, ctx.user_id) if ctx.user_id else None
    start, end = tasks_service.day_bounds()
    overdue = list(
        (
            await ctx.session.scalars(
                scoped(Task, ctx.workspace_id)
                .where(Task.done.is_(False), Task.due_at < start)
                .order_by(Task.due_at)
                .limit(20)
            )
        ).all()
    )
    due_today = list(
        (
            await ctx.session.scalars(
                scoped(Task, ctx.workspace_id)
                .where(Task.done.is_(False), Task.due_at >= start, Task.due_at < end)
                .order_by(Task.due_at)
                .limit(20)
            )
        ).all()
    )
    stats, stages = await pipeline_stats(ctx)
    stale = await deals_service.list_all_deals(ctx, DealFilter(stale_days=STALE_DAYS))
    stale.sort(key=lambda d: d.last_activity_at or d.created_at)
    return TodayOut(
        date=utcnow().date(),
        first_name=(user.full_name.split()[0] if user and user.full_name else "there"),
        tasks_overdue=await tasks_service.enrich(ctx, overdue),
        tasks_today=await tasks_service.enrich(ctx, due_today),
        contact_queue=await contact_queue(ctx),
        stats=stats,
        stages=stages,
        stale_deals=stale[:6],
    )
