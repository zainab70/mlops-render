"""seed demo experiments, models and deployments

Invented demo values for the brain-MRI classifier use case (docs/product.md); no real results.
Source of the values is recorded in docs/learn/DB-001.md.

Revision ID: 0002
Revises: 0001
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

experiments = sa.table(
    "experiments",
    sa.column("id", sa.Integer),
    sa.column("name", sa.String),
    sa.column("status", sa.String),
    sa.column("accuracy", sa.Float),
    sa.column("loss", sa.Float),
    sa.column("epochs", sa.Integer),
)
models = sa.table(
    "models",
    sa.column("id", sa.Integer),
    sa.column("name", sa.String),
    sa.column("version", sa.String),
    sa.column("framework", sa.String),
    sa.column("accuracy", sa.Float),
    sa.column("stage", sa.String),
    sa.column("experiment_id", sa.Integer),
)
deployments = sa.table(
    "deployments",
    sa.column("id", sa.Integer),
    sa.column("name", sa.String),
    sa.column("environment", sa.String),
    sa.column("status", sa.String),
    sa.column("model_id", sa.Integer),
    sa.column("replicas", sa.Integer),
)

EXPERIMENTS = [
    {"id": 1, "name": "cnn-baseline-mri", "status": "completed", "accuracy": 0.842, "loss": 0.412, "epochs": 20},
    {"id": 2, "name": "cnn-augmented-mri", "status": "completed", "accuracy": 0.881, "loss": 0.335, "epochs": 30},
    {"id": 3, "name": "resnet18-transfer-mri", "status": "running", "accuracy": None, "loss": None, "epochs": 25},
    {"id": 4, "name": "cnn-dropout-sweep", "status": "failed", "accuracy": None, "loss": None, "epochs": 15},
]
MODELS = [
    {"id": 1, "name": "alzheimer-cnn", "version": "1.0.0", "framework": "PyTorch",
     "accuracy": 0.842, "stage": "archived", "experiment_id": 1},
    {"id": 2, "name": "alzheimer-cnn", "version": "1.1.0", "framework": "PyTorch",
     "accuracy": 0.881, "stage": "production", "experiment_id": 2},
    {"id": 3, "name": "alzheimer-resnet18", "version": "0.1.0", "framework": "PyTorch",
     "accuracy": None, "stage": "staging", "experiment_id": 3},
]
DEPLOYMENTS = [
    {"id": 1, "name": "alzheimer-api-prod", "environment": "production", "status": "healthy",
     "model_id": 2, "replicas": 2},
    {"id": 2, "name": "alzheimer-api-staging", "environment": "staging", "status": "degraded",
     "model_id": 3, "replicas": 1},
]


def upgrade() -> None:
    op.bulk_insert(experiments, EXPERIMENTS)
    op.bulk_insert(models, MODELS)
    op.bulk_insert(deployments, DEPLOYMENTS)
    # explicit ids were inserted, so move each id sequence past them for future inserts
    for table in ("experiments", "models", "deployments"):
        op.execute(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), (SELECT MAX(id) FROM {table}))")


def downgrade() -> None:
    op.execute(sa.delete(deployments).where(deployments.c.id.in_([d["id"] for d in DEPLOYMENTS])))
    op.execute(sa.delete(models).where(models.c.id.in_([m["id"] for m in MODELS])))
    op.execute(sa.delete(experiments).where(experiments.c.id.in_([e["id"] for e in EXPERIMENTS])))
