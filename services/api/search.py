"""Search experiments, models and deployments by name: SEARCH-001.

GET /search?q= answers every group, empty when nothing matches. Signed-in users only (current_user
on the router), read-only, and q is always a bound parameter.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, StringConstraints
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import current_user
from db import get_db
from models import Deployment, Experiment, Model

LIMIT_PER_TYPE = 5
MAX_QUERY_LENGTH = 100

router = APIRouter(dependencies=[Depends(current_user)])


class Hit(BaseModel):
    """Experiment and deployment names are unique, so id + name identify them."""

    id: int
    name: str


class ModelHit(Hit):
    # Model names repeat across versions (the same name at 1.0.0 and 1.1.0).
    version: str
    stage: str


class SearchResults(BaseModel):
    experiments: list[Hit]
    models: list[ModelHit]
    deployments: list[Hit]


SearchQuery = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=MAX_QUERY_LENGTH),
    Query(),
]


def _contains(q: str) -> str:
    """An ILIKE pattern that matches q anywhere; %, _ and \\ typed by the user stay literal."""
    escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _matching(db: Session, table, pattern: str) -> list:
    query = (
        select(table)
        .where(table.name.ilike(pattern, escape="\\"))
        .order_by(table.name, table.id)
        .limit(LIMIT_PER_TYPE)
    )
    return list(db.scalars(query))


@router.get("/search", response_model=SearchResults)
def search(q: SearchQuery, db: Session = Depends(get_db)) -> dict:
    pattern = _contains(q)
    return {
        "experiments": _matching(db, Experiment, pattern),
        "models": _matching(db, Model, pattern),
        "deployments": _matching(db, Deployment, pattern),
    }
