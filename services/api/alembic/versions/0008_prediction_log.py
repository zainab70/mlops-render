"""every /predict and /explain answer stored with its scan statistics

- predictions: one row per answer, errors included (prediction_log.py): time, path, status, latency,
  and for a successful answer the model_version, predicted class and confidence plus the numbers
  measured on the scan (scan_stats.py: mean, std, width, height). Never the scan itself.

Revision ID: 0008
Revises: 0007
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Fresh Column objects on every call: db:check upgrades twice in one process.
    op.create_table(
        "predictions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("path", sa.String(20), nullable=False),
        sa.Column("status", sa.Integer, nullable=False),
        sa.Column("latency_ms", sa.Float, nullable=False),
        sa.Column("model_version", sa.String(40), nullable=True),
        sa.Column("predicted_class", sa.String(40), nullable=True),
        sa.Column("confidence", sa.Float, nullable=True),
        sa.Column("mean", sa.Float, nullable=True),
        sa.Column("std", sa.Float, nullable=True),
        sa.Column("width", sa.Float, nullable=True),
        sa.Column("height", sa.Float, nullable=True),
    )
    # Monitoring and deployments read by time window (last 24 h, 7 days, 6 weeks).
    op.create_index("ix_predictions_created_at", "predictions", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_predictions_created_at", table_name="predictions")
    op.drop_table("predictions")
