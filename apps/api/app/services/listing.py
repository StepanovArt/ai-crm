"""Shared list helpers: `?q=&limit=&cursor=&sort=&filter=` conventions."""

import json
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ValidationError
from sqlalchemy import Numeric, cast, nulls_last
from sqlalchemy.orm import InstrumentedAttribute
from sqlalchemy.sql.elements import ColumnElement

from app.errors import ValidationFailed
from app.models import FieldDefinition

MAX_LIMIT = 500


@dataclass(frozen=True)
class ListParams:
    q: str | None = None
    limit: int = 50
    cursor: str | None = None
    sort: str | None = None

    @property
    def offset(self) -> int:
        if not self.cursor:
            return 0
        try:
            return max(0, int(self.cursor))
        except ValueError as exc:
            raise ValidationFailed("Invalid cursor") from exc

    @property
    def safe_limit(self) -> int:
        return max(1, min(self.limit, MAX_LIMIT))

    def next_cursor(self, total: int) -> str | None:
        nxt = self.offset + self.safe_limit
        return str(nxt) if nxt < total else None


def parse_filter[F: BaseModel](raw: str | None, model: type[F]) -> F:
    if not raw:
        return model()
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValidationFailed("filter must be a JSON object") from exc
    if not isinstance(data, dict):
        raise ValidationFailed("filter must be a JSON object")
    try:
        return model.model_validate(data)
    except ValidationError as exc:
        first = exc.errors()[0]
        loc = ".".join(str(p) for p in first.get("loc", ()))
        raise ValidationFailed(f"Invalid filter {loc}: {first.get('msg', '')}") from exc


def sort_clauses(
    sort: str | None,
    allowed: dict[str, ColumnElement[Any] | InstrumentedAttribute[Any]],
    *,
    custom_col: InstrumentedAttribute[dict[str, Any]] | None = None,
    custom_defs: list[FieldDefinition] | None = None,
    default: str,
) -> list[ColumnElement[Any]]:
    """Translate `sort=-value,name` (or `custom.<key>`) into ORDER BY clauses."""
    clauses: list[ColumnElement[Any]] = []
    for part in (sort or default).split(","):
        part = part.strip()
        if not part:
            continue
        desc = part.startswith("-")
        key = part.lstrip("-")
        col: ColumnElement[Any]
        if key.startswith("custom.") and custom_col is not None:
            field_key = key.removeprefix("custom.")
            defn = next((d for d in custom_defs or [] if d.key == field_key), None)
            if defn is None:
                raise ValidationFailed(f"Cannot sort by unknown field {field_key}")
            raw = custom_col[field_key]
            col = cast(raw.astext, Numeric) if defn.type in ("number", "currency") else raw.astext
        elif key in allowed:
            col = allowed[key]  # type: ignore[assignment]
        else:
            raise ValidationFailed(f"Cannot sort by {key}")
        clauses.append(nulls_last(col.desc() if desc else col.asc()))
    return clauses


def like(q: str) -> str:
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped.strip()}%"
