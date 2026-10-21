from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.models.base import utcnow


def zone(tz: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(tz or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo("UTC")


def local_now(tz: str | None) -> datetime:
    return utcnow().astimezone(zone(tz))


def due_at(days: int, hour: int = 10, tz: str | None = None) -> datetime:
    """`days` from today at `hour` local time, as an aware UTC datetime."""
    now = local_now(tz)
    target = datetime.combine(now.date() + timedelta(days=days), time(hour), now.tzinfo)
    return target.astimezone(UTC)


def next_business_days(n: int, tz: str | None = None) -> list[date]:
    out: list[date] = []
    d = local_now(tz).date()
    while len(out) < n:
        d += timedelta(days=1)
        if d.weekday() < 5:
            out.append(d)
    return out


def ago(when: datetime | None, now: datetime | None = None) -> str:
    if when is None:
        return "never"
    days = ((now or utcnow()) - when).days
    if days <= 0:
        return "today"
    if days == 1:
        return "yesterday"
    if days < 14:
        return f"{days} days ago"
    if days < 60:
        return f"{days // 7} weeks ago"
    return f"{days // 30} months ago"


def greeting(tz: str | None) -> str:
    h = local_now(tz).hour
    return "Good morning" if h < 12 else "Good afternoon" if h < 18 else "Good evening"


def fmt_day(d: date | datetime) -> str:
    return d.strftime("%a, %b %-d")


def money(value: object, currency: str = "USD", compact: bool = True) -> str:
    try:
        amount = float(str(value))
    except ValueError:
        amount = 0.0
    symbol = {"USD": "$", "EUR": "€", "GBP": "£"}.get(currency, "")
    if compact and abs(amount) >= 1_000_000:
        body = f"{amount / 1_000_000:.2f}".rstrip("0").rstrip(".") + "M"
    elif compact and abs(amount) >= 10_000:
        body = f"{amount / 1_000:.1f}".rstrip("0").rstrip(".") + "K"
    else:
        body = f"{amount:,.0f}"
    return f"{symbol}{body}" if symbol else f"{body} {currency}"
