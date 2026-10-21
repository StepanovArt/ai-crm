import uuid

from fastapi import APIRouter, status

from app.deps import CtxDep
from app.schemas.common import OkOut
from app.schemas.fields import (
    FieldDefinitionCreate,
    FieldDefinitionOut,
    FieldDefinitionUpdate,
    FieldReorder,
    ObjectType,
)
from app.services import fields as service

router = APIRouter(prefix="/fields", tags=["fields"])


@router.get("", response_model=list[FieldDefinitionOut])
async def list_fields(
    ctx: CtxDep, object_type: ObjectType | None = None
) -> list[FieldDefinitionOut]:
    return [
        FieldDefinitionOut.model_validate(d)
        for d in await service.list_definitions(ctx, object_type)
    ]


@router.post("", response_model=FieldDefinitionOut, status_code=status.HTTP_201_CREATED)
async def create_field(body: FieldDefinitionCreate, ctx: CtxDep) -> FieldDefinitionOut:
    defn = await service.create_definition(
        ctx,
        object_type=body.object_type,
        label=body.label,
        type=body.type,
        key=body.key,
        options=[o.model_dump() for o in body.options] if body.options is not None else None,
        is_required=body.is_required,
    )
    return FieldDefinitionOut.model_validate(defn)


@router.post("/reorder", response_model=list[FieldDefinitionOut])
async def reorder_fields(body: FieldReorder, ctx: CtxDep) -> list[FieldDefinitionOut]:
    defs = await service.reorder_definitions(ctx, body.object_type, body.field_ids)
    return [FieldDefinitionOut.model_validate(d) for d in defs]


@router.patch("/{field_id}", response_model=FieldDefinitionOut)
async def update_field(
    field_id: uuid.UUID, body: FieldDefinitionUpdate, ctx: CtxDep
) -> FieldDefinitionOut:
    defn = await service.update_definition(
        ctx,
        field_id,
        label=body.label,
        options=[o.model_dump() for o in body.options] if body.options is not None else None,
        is_required=body.is_required,
    )
    return FieldDefinitionOut.model_validate(defn)


@router.delete("/{field_id}", response_model=OkOut)
async def delete_field(field_id: uuid.UUID, ctx: CtxDep) -> OkOut:
    await service.delete_definition(ctx, field_id)
    return OkOut()
