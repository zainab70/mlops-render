"""model versions registered from real training runs

- models gets what the Models page shows about a version: description, size_bytes (of model.pt) and
  stage_changed_at (when the stage last changed; API-008 sets it, so "Deployed" = became production).
- source says where a row came from: 'training' (registered by record_run.py) or 'demo' (the invented
  seed rows of 0002). Every existing row becomes 'demo'.

Revision ID: 0007
Revises: 0006
"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

NEW_COLUMNS = {
    "description": lambda: sa.String(500),
    "size_bytes": sa.BigInteger,
    "stage_changed_at": lambda: sa.DateTime(timezone=True),
}


def upgrade() -> None:
    # Fresh Column objects on every call: db:check upgrades twice in one process.
    for name, type_ in NEW_COLUMNS.items():
        op.add_column("models", sa.Column(name, type_(), nullable=True))
    # server_default fills the existing (seed) rows with 'demo' as the column is added.
    op.add_column("models", sa.Column("source", sa.String(20), server_default="demo", nullable=False))
    op.create_check_constraint("models_source_check", "models", "source IN ('demo', 'training')")


def downgrade() -> None:
    op.drop_constraint("models_source_check", "models", type_="check")
    op.drop_column("models", "source")
    for name in reversed(list(NEW_COLUMNS)):
        op.drop_column("models", name)
