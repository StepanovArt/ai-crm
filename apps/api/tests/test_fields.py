import uuid

import pytest

from app.errors import ConflictError, ValidationFailed
from app.models import FieldDefinition
from app.seed.demo import DEMO_USER_ID
from app.services import fields as fields_service
from app.services.context import Ctx


def _defn(type: str, **kw: object) -> FieldDefinition:
    return FieldDefinition(
        workspace_id=uuid.uuid4(),
        object_type="deal",
        key="f",
        label=kw.pop("label", "Field"),  # type: ignore[arg-type]
        type=type,
        options=kw.pop("options", []),  # type: ignore[arg-type]
        is_required=kw.pop("is_required", False),  # type: ignore[arg-type]
    )


@pytest.mark.parametrize(
    ("type", "raw", "expected"),
    [
        ("text", "  hello ", "hello"),
        ("number", "1,200", 1200),
        ("number", 3.5, 3.5),
        ("currency", "1234.5", "1234.50"),
        ("currency", 99, "99.00"),
        ("date", "2026-03-04T10:00:00Z", "2026-03-04"),
        ("email", "Bob@Example.com ", "bob@example.com"),
        ("phone", "+1 (555) 010-2000", "+1 (555) 010-2000"),
        ("url", "acme.com", "https://acme.com"),
        ("checkbox", True, True),
    ],
)
def test_validate_value_normalizes(type: str, raw: object, expected: object) -> None:
    assert fields_service.validate_value(_defn(type), raw) == expected


@pytest.mark.parametrize(
    ("type", "raw"),
    [
        ("number", "abc"),
        ("number", True),
        ("currency", "ten"),
        ("date", "31/12/2026"),
        ("email", "not-an-email"),
        ("url", "not a url"),
        ("checkbox", "yes"),
        ("text", 42),
    ],
)
def test_validate_value_rejects(type: str, raw: object) -> None:
    with pytest.raises(ValidationFailed):
        fields_service.validate_value(_defn(type), raw)


def test_select_and_multi_select() -> None:
    options = [{"value": "hot", "label": "Hot"}, {"value": "cold", "label": "Cold"}]
    assert fields_service.validate_value(_defn("select", options=options), "hot") == "hot"
    with pytest.raises(ValidationFailed):
        fields_service.validate_value(_defn("select", options=options), "warm")
    multi = _defn("multi_select", options=options)
    assert fields_service.validate_value(multi, ["hot", "hot", "cold"]) == ["hot", "cold"]
    with pytest.raises(ValidationFailed):
        fields_service.validate_value(multi, ["hot", "lukewarm"])


def test_required_rejects_empty() -> None:
    with pytest.raises(ValidationFailed):
        fields_service.validate_value(_defn("text", is_required=True), "")
    assert fields_service.validate_value(_defn("text"), "") is None


async def test_validate_custom_unknown_key_and_merge(ctx: Ctx) -> None:
    with pytest.raises(ValidationFailed):
        await fields_service.validate_custom(ctx, "deal", {"nope": 1})
    merged = await fields_service.validate_custom(
        ctx,
        "deal",
        {"seats": "40", "next_step": None},
        existing={"next_step": "x", "source": "inbound"},
    )
    assert merged == {"seats": 40, "source": "inbound"}


async def test_user_field_requires_member(ctx: Ctx) -> None:
    await fields_service.create_definition(ctx, object_type="deal", label="Reviewer", type="user")
    ok = await fields_service.validate_custom(ctx, "deal", {"reviewer": str(DEMO_USER_ID)})
    assert ok["reviewer"] == str(DEMO_USER_ID)
    with pytest.raises(ValidationFailed):
        await fields_service.validate_custom(ctx, "deal", {"reviewer": str(uuid.uuid4())})


async def test_create_definition_rules(ctx: Ctx) -> None:
    defn = await fields_service.create_definition(
        ctx,
        object_type="company",
        label="Customer tier",
        type="select",
        options=[{"label": "Gold"}, {"label": "Silver"}],
    )
    assert defn.key == "customer_tier"
    assert [o["value"] for o in defn.options] == ["gold", "silver"]
    with pytest.raises(ConflictError):
        await fields_service.create_definition(
            ctx, object_type="company", label="Customer tier", type="text"
        )
    with pytest.raises(ValidationFailed):
        await fields_service.create_definition(
            ctx, object_type="company", label="Empty", type="select", options=[]
        )
    with pytest.raises(ValidationFailed):
        await fields_service.create_definition(ctx, object_type="planet", label="X", type="text")
