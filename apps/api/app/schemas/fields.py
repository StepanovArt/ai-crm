import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel, OutModel

ObjectType = Literal["company", "contact", "deal"]
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


class FieldOption(BaseModel):
    value: str | None = None
    label: str
    color: str | None = None


class FieldOptionOut(OutModel):
    value: str
    label: str
    color: str


class FieldDefinitionOut(ORMModel):
    id: uuid.UUID
    object_type: ObjectType
    key: str
    label: str
    type: FieldType
    options: list[FieldOptionOut]
    position: int
    is_required: bool
    is_system: bool


class FieldDefinitionCreate(BaseModel):
    object_type: ObjectType
    label: str = Field(min_length=1, max_length=120)
    type: FieldType
    key: str | None = Field(default=None, max_length=63)
    options: list[FieldOption] | None = None
    is_required: bool = False


class FieldDefinitionUpdate(BaseModel):
    label: str | None = Field(default=None, min_length=1, max_length=120)
    options: list[FieldOption] | None = None
    is_required: bool | None = None


class FieldReorder(BaseModel):
    object_type: ObjectType
    field_ids: list[uuid.UUID]
