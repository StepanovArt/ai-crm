from typing import Annotated

from fastapi import Depends, Query

from app.services.listing import MAX_LIMIT, ListParams


def list_params(
    q: Annotated[str | None, Query(max_length=200)] = None,
    limit: Annotated[int, Query(ge=1, le=MAX_LIMIT)] = 50,
    cursor: str | None = None,
    sort: Annotated[str | None, Query(max_length=200)] = None,
) -> ListParams:
    return ListParams(q=q, limit=limit, cursor=cursor, sort=sort)


ListParamsDep = Annotated[ListParams, Depends(list_params)]
FilterQuery = Annotated[str | None, Query(description="JSON-encoded filter object")]
