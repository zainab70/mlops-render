"""users and sessions tables, one demo user per role

The demo users' password comes from the environment variable DEMO_USER_PASSWORD (name only, never a
value in the repo). If it is not set, the users are created with an unusable password: they exist,
but nobody can sign in as them.

Revision ID: 0003
Revises: 0002
"""

import os

import sqlalchemy as sa
from alembic import op

from security import UNUSABLE_PASSWORD, hash_password

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

DEMO_USERS = [
    {"email": "admin@mlops.local", "name": "Ada Admin", "role": "admin"},
    {"email": "engineer@mlops.local", "name": "Eli Engineer", "role": "ml_engineer"},
]


def upgrade() -> None:
    users = op.create_table(
        "users",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("email", sa.String(254), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("role IN ('admin', 'ml_engineer')", name="users_role_check"),
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    password = os.environ.get("DEMO_USER_PASSWORD", "").strip()
    password_hash = hash_password(password) if password else UNUSABLE_PASSWORD
    op.bulk_insert(users, [{**u, "password_hash": password_hash} for u in DEMO_USERS])


def downgrade() -> None:
    op.drop_table("sessions")
    op.drop_table("users")
