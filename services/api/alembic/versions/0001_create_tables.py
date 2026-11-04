"""create experiments, models and deployments tables

Revision ID: 0001
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "experiments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("accuracy", sa.Float),
        sa.Column("loss", sa.Float),
        sa.Column("epochs", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_table(
        "models",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("version", sa.String(20), nullable=False),
        sa.Column("framework", sa.String(40), nullable=False),
        sa.Column("accuracy", sa.Float),
        sa.Column("stage", sa.String(20), nullable=False),
        sa.Column("experiment_id", sa.Integer, sa.ForeignKey("experiments.id")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("name", "version"),
    )
    op.create_table(
        "deployments",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("environment", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("model_id", sa.Integer, sa.ForeignKey("models.id"), nullable=False),
        sa.Column("replicas", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("deployments")
    op.drop_table("models")
    op.drop_table("experiments")
