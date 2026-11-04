"""experiments recorded from real training runs

- experiments gets the numbers a training run folder holds (record_run.py): precision, recall, f1
  (macro means), duration_seconds, parameters (JSON: learning rate, batch size, epochs, seed, ...),
  dataset_kind (dev = not a valid performance estimate) and model_version.
- source says where a row came from: 'training' (a recorded run) or 'demo' (the invented seed rows of
  0002). Every existing row becomes 'demo'.

Revision ID: 0006
Revises: 0005
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

NEW_COLUMNS = {
    "precision": sa.Float,
    "recall": sa.Float,
    "f1": sa.Float,
    "duration_seconds": sa.Float,
    "parameters": sa.JSON,
    "dataset_kind": lambda: sa.String(20),
    "model_version": lambda: sa.String(40),
}


def upgrade() -> None:
    # Fresh Column objects on every call: db:check upgrades twice in one process.
    for name, type_ in NEW_COLUMNS.items():
        op.add_column("experiments", sa.Column(name, type_(), nullable=True))
    # server_default fills the existing (seed) rows with 'demo' as the column is added.
    op.add_column("experiments", sa.Column("source", sa.String(20), server_default="demo", nullable=False))
    op.create_check_constraint("experiments_source_check", "experiments", "source IN ('demo', 'training')")


def downgrade() -> None:
    op.drop_constraint("experiments_source_check", "experiments", type_="check")
    op.drop_column("experiments", "source")
    for name in reversed(list(NEW_COLUMNS)):
        op.drop_column("experiments", name)
