"""Custom field definitions and value validation.

Records keep custom values in `custom` JSONB keyed by `field_definitions.key`.
Every write goes through `validate_custom` so stored values are always normalized.
"""

import re
import uuid
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Literal, get_args

from sqlalchemy import func, select, update

from app.errors import ConflictError, ValidationFailed
from app.models import Company, Contact, Deal, FieldDefinition, Membership
from app.services.context import Ctx
from app.services.scoping import get_scoped, scoped

FieldType = Literal[
    "text",
    "long_text",
    "number",
    "currency",
    "date",
    "select",
    "multi_select",
    "email",
    "phone",
    "url",
    "user",
    "checkbox",
]
ObjectType = Literal["company", "contact", "deal"]

FIELD_TYPES: tuple[str, ...] = get_args(FieldType)
OBJECT_TYPES: tuple[str, ...] = get_args(ObjectType)
OPTION_TYPES = frozenset({"select", "multi_select"})
OPTION_COLORS = (
    "slate",
    "gray",
    "red",
    "orange",
    "amber",
    "green",
    "teal",
    "blue",
    "indigo",
    "violet",
    "pink",
)

RECORD_MODELS: dict[str, type[Company] | type[Contact] | type[Deal]] = {
    "company": Company,
    "contact": Contact,
    "deal": Deal,
}

JsonValue = str | int | float | bool | list[str] | None

_KEY_RE = re.compile(r"^[a-z][a-z0-9_]{0,62}$")
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^\+?[0-9 ()\-.]{5,32}$")
_URL_RE = re.compile(r"^(https?://)?([a-z0-9-]+\.)+[a-z]{2,}(/\S*)?$", re.IGNORECASE)
MAX_TEXT = 500
MAX_LONG_TEXT = 20_000


def slugify_key(label: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", label.lower()).strip("_")
    if not slug or not slug[0].isalpha():
        slug = f"f_{slug}"
    return slug[:63]


def option_values(defn: FieldDefinition) -> set[str]:
    return {str(o.get("value")) for o in defn.options or []}


def validate_value(defn: FieldDefinition, value: object) -> JsonValue:
    """Validate and normalize one value against its definition. Raises ValidationFailed."""
    label = defn.label
    if value is None or value == "" or value == []:
        if defn.is_required:
            raise ValidationFailed(f"{label} is required")
        return None

    t = defn.type
    if t in ("text", "long_text"):
        if not isinstance(value, str):
            raise ValidationFailed(f"{label} must be text")
        limit = MAX_TEXT if t == "text" else MAX_LONG_TEXT
        if len(value) > limit:
            raise ValidationFailed(f"{label} must be at most {limit} characters")
        return value.strip() if t == "text" else value
    if t == "number":
        return _as_number(label, value)
    if t == "currency":
        return _as_money(label, value)
    if t == "date":
        if isinstance(value, date):
            return value.isoformat()
        if isinstance(value, str):
            try:
                return date.fromisoformat(value[:10]).isoformat()
            except ValueError:
                pass
        raise ValidationFailed(f"{label} must be a date (YYYY-MM-DD)")
    if t == "select":
        if not isinstance(value, str) or value not in option_values(defn):
            raise ValidationFailed(
                f"{label} must be one of: {', '.join(sorted(option_values(defn)))}"
            )
        return value
    if t == "multi_select":
        if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
            raise ValidationFailed(f"{label} must be a list of options")
        allowed = option_values(defn)
        bad = [v for v in value if v not in allowed]
        if bad:
            raise ValidationFailed(f"{label} has unknown options: {', '.join(bad)}")
        return list(dict.fromkeys(value))
    if t == "email":
        if not isinstance(value, str) or not _EMAIL_RE.match(value.strip()):
            raise ValidationFailed(f"{label} must be a valid email")
        return value.strip().lower()
    if t == "phone":
        if not isinstance(value, str) or not _PHONE_RE.match(value.strip()):
            raise ValidationFailed(f"{label} must be a valid phone number")
        return value.strip()
    if t == "url":
        if not isinstance(value, str) or not _URL_RE.match(value.strip()):
            raise ValidationFailed(f"{label} must be a valid URL")
        v = value.strip()
        return v if v.startswith(("http://", "https://")) else f"https://{v}"
    if t == "user":
        try:
            return str(uuid.UUID(str(value)))
        except ValueError as exc:
            raise ValidationFailed(f"{label} must reference a user") from exc
    if t == "checkbox":
        if not isinstance(value, bool):
            raise ValidationFailed(f"{label} must be true or false")
        return value
    raise ValidationFailed(f"{label} has unsupported type {t}")


def _as_number(label: str, value: object) -> int | float:
    if isinstance(value, bool):
        raise ValidationFailed(f"{label} must be a number")
    if isinstance(value, int | float):
        return value
    if isinstance(value, str):
        try:
            num = float(value.replace(",", ""))
        except ValueError:
            pass
        else:
            return int(num) if num.is_integer() else num
    raise ValidationFailed(f"{label} must be a number")


def _as_money(label: str, value: object) -> str:
    if isinstance(value, bool):
        raise ValidationFailed(f"{label} must be an amount")
    try:
        amount = Decimal(str(value).replace(",", ""))
    except InvalidOperation as exc:
        raise ValidationFailed(f"{label} must be an amount") from exc
    if not amount.is_finite():
        raise ValidationFailed(f"{label} must be an amount")
    return str(amount.quantize(Decimal("0.01")))


async def list_definitions(ctx: Ctx, object_type: str | None = None) -> list[FieldDefinition]:
    stmt = scoped(FieldDefinition, ctx.workspace_id)
    if object_type is not None:
        stmt = stmt.where(FieldDefinition.object_type == object_type)
    stmt = stmt.order_by(
        FieldDefinition.object_type, FieldDefinition.position, FieldDefinition.created_at
    )
    return list((await ctx.session.scalars(stmt)).all())


async def validate_custom(
    ctx: Ctx,
    object_type: str,
    values: dict[str, Any],
    *,
    existing: dict[str, Any] | None = None,
    partial: bool = False,
) -> dict[str, Any]:
    """Validate custom values and return the merged, normalized `custom` dict."""
    defs = {d.key: d for d in await list_definitions(ctx, object_type)}
    unknown = sorted(set(values) - set(defs))
    if unknown:
        raise ValidationFailed(f"Unknown field(s): {', '.join(unknown)}")
    merged: dict[str, Any] = dict(existing or {})
    for key, raw in values.items():
        normalized = validate_value(defs[key], raw)
        if defs[key].type == "user" and normalized is not None:
            await _ensure_member(ctx, uuid.UUID(str(normalized)), defs[key].label)
        if normalized is None:
            merged.pop(key, None)
        else:
            merged[key] = normalized
    if not partial:
        missing = [
            d.label for d in defs.values() if d.is_required and merged.get(d.key) in (None, "", [])
        ]
        if missing:
            raise ValidationFailed(f"Missing required field(s): {', '.join(missing)}")
    return merged


async def _ensure_member(ctx: Ctx, user_id: uuid.UUID, label: str) -> None:
    member = await ctx.session.scalar(
        select(Membership.id).where(
            Membership.workspace_id == ctx.workspace_id, Membership.user_id == user_id
        )
    )
    if member is None:
        raise ValidationFailed(f"{label} must reference a workspace member")


def normalize_options(
    field_type: str, options: list[dict[str, Any]] | None
) -> list[dict[str, Any]]:
    if field_type not in OPTION_TYPES:
        return []
    if not options:
        raise ValidationFailed("Select fields need at least one option")
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for i, opt in enumerate(options):
        label = str(opt.get("label") or opt.get("value") or "").strip()
        if not label:
            raise ValidationFailed("Every option needs a label")
        value = str(opt.get("value") or slugify_key(label))
        if value in seen:
            raise ValidationFailed(f"Duplicate option: {label}")
        seen.add(value)
        color = str(opt.get("color") or OPTION_COLORS[i % len(OPTION_COLORS)])
        out.append({"value": value, "label": label, "color": color})
    return out


async def create_definition(
    ctx: Ctx,
    *,
    object_type: str,
    label: str,
    type: str,
    key: str | None = None,
    options: list[dict[str, Any]] | None = None,
    is_required: bool = False,
    position: int | None = None,
) -> FieldDefinition:
    if object_type not in OBJECT_TYPES:
        raise ValidationFailed(f"Unknown object type: {object_type}")
    if type not in FIELD_TYPES:
        raise ValidationFailed(f"Unknown field type: {type}")
    label = label.strip()
    if not label:
        raise ValidationFailed("Label is required")
    key = key or slugify_key(label)
    if not _KEY_RE.match(key):
        raise ValidationFailed("Key must be lowercase letters, digits and underscores")
    exists = await ctx.session.scalar(
        scoped(FieldDefinition, ctx.workspace_id).where(
            FieldDefinition.object_type == object_type, FieldDefinition.key == key
        )
    )
    if exists is not None:
        raise ConflictError(f"A field with key '{key}' already exists")
    if position is None:
        current_max = await ctx.session.scalar(
            select(func.max(FieldDefinition.position)).where(
                FieldDefinition.workspace_id == ctx.workspace_id,
                FieldDefinition.object_type == object_type,
            )
        )
        position = (current_max if current_max is not None else -1) + 1
    defn = FieldDefinition(
        workspace_id=ctx.workspace_id,
        object_type=object_type,
        key=key,
        label=label,
        type=type,
        options=normalize_options(type, options),
        position=position,
        is_required=is_required,
        is_system=False,
    )
    ctx.session.add(defn)
    await ctx.session.flush()
    return defn


async def update_definition(
    ctx: Ctx,
    field_id: uuid.UUID,
    *,
    label: str | None = None,
    options: list[dict[str, Any]] | None = None,
    is_required: bool | None = None,
    position: int | None = None,
) -> FieldDefinition:
    defn = await get_scoped(ctx, FieldDefinition, field_id, "Field")
    if label is not None:
        if not label.strip():
            raise ValidationFailed("Label is required")
        defn.label = label.strip()
    if options is not None:
        defn.options = normalize_options(defn.type, options)
    if is_required is not None:
        defn.is_required = is_required
    if position is not None:
        defn.position = position
    await ctx.session.flush()
    return defn


async def reorder_definitions(
    ctx: Ctx, object_type: str, ordered_ids: list[uuid.UUID]
) -> list[FieldDefinition]:
    defs = {d.id: d for d in await list_definitions(ctx, object_type)}
    if set(ordered_ids) != set(defs):
        raise ValidationFailed("Reorder must include every field of the object exactly once")
    for i, fid in enumerate(ordered_ids):
        defs[fid].position = i
    await ctx.session.flush()
    return sorted(defs.values(), key=lambda d: d.position)


async def delete_definition(ctx: Ctx, field_id: uuid.UUID) -> None:
    defn = await get_scoped(ctx, FieldDefinition, field_id, "Field")
    if defn.is_system:
        raise ValidationFailed("System fields cannot be deleted")
    model = RECORD_MODELS[defn.object_type]
    await ctx.session.execute(
        update(model)
        .where(model.workspace_id == ctx.workspace_id, model.custom.has_key(defn.key))
        .values(custom=model.custom - defn.key)
    )
    await ctx.session.delete(defn)
    await ctx.session.flush()
