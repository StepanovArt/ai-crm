from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, ConfigDict, PlainSerializer


class OutModel(BaseModel):
    """Response models: fields with defaults are still required in the generated TS types."""

    model_config = ConfigDict(json_schema_serialization_defaults_required=True)


class ORMModel(OutModel):
    model_config = ConfigDict(
        from_attributes=True, json_schema_serialization_defaults_required=True
    )


class Page[T](OutModel):
    items: list[T]
    next_cursor: str | None = None
    total: int


class OkOut(OutModel):
    ok: bool = True


def _money(value: Decimal) -> str:
    return str(Decimal(value).quantize(Decimal("0.01")))


# Money is always serialized as a 2-decimal string ("1234.50").
Money = Annotated[Decimal, PlainSerializer(_money, return_type=str, when_used="json")]
