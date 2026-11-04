"""List, show and export experiments for the Experiments page: API-006.

Signed-in users only (current_user on the router) and read-only: rows are added by record_run.py
(ML-004) or the seed. The CSV export runs the same query and the same fields as the list, so the
file always equals what the page shows. No pagination yet; the table is small.
"""

import csv
import io
from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from auth import current_user
from db import get_db
from models import Experiment

Status = Literal["running", "completed", "failed"]

router = APIRouter(prefix="/experiments", dependencies=[Depends(current_user)])


class ExperimentRow(BaseModel):
    """One line of the table, the chart and the CSV. dataset_kind 'dev' = not a valid performance estimate."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: str
    source: str
    dataset_kind: str | None
    accuracy: float | None
    precision: float | None
    recall: float | None
    f1: float | None
    duration_seconds: float | None
    created_at: datetime


class ExperimentDetails(ExperimentRow):
    parameters: dict | None
    epochs: int
    model_version: str | None


CSV_FIELDS = list(ExperimentRow.model_fields)


def _rows(db: Session, wanted: Status | None) -> list[Experiment]:
    # Rows inserted together share created_at, so the id (later insert = higher) breaks the tie.
    query = select(Experiment).order_by(Experiment.created_at.desc(), Experiment.id.desc())
    if wanted is not None:
        query = query.where(Experiment.status == wanted)
    return list(db.scalars(query))


@router.get("", response_model=list[ExperimentRow])
def list_experiments(
    wanted: Status | None = Query(default=None, alias="status"), db: Session = Depends(get_db)
) -> list[Experiment]:
    return _rows(db, wanted)


# Declared before /{experiment_id}, so "export.csv" is never read as an id.
@router.get("/export.csv", response_class=Response)
def export_experiments(
    wanted: Status | None = Query(default=None, alias="status"), db: Session = Depends(get_db)
) -> Response:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for row in _rows(db, wanted):
        # mode="json" gives the same values the list answers (ISO dates); csv writes None as "".
        writer.writerow(ExperimentRow.model_validate(row).model_dump(mode="json"))
    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="experiments.csv"'},
    )


@router.get("/{experiment_id}", response_model=ExperimentDetails)
def show_experiment(experiment_id: int, db: Session = Depends(get_db)) -> Experiment:
    row = db.get(Experiment, experiment_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="experiment not found")
    return row
