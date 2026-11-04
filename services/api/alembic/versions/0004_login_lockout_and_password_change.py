"""failed-login lockout table and the "must change password" flag

- login_attempts: one row per email key (an HMAC of the email, never the email itself), counting wrong
  passwords. Unknown emails get a row too, so the lockout does not reveal which emails exist.
- users.must_change_password: true for users an admin creates; existing users (the demo users) get false.

Revision ID: 0004
Revises: 0003
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean, server_default=sa.false(), nullable=False),
    )
    op.create_table(
        "login_attempts",
        sa.Column("email_key", sa.String(64), primary_key=True),
        sa.Column("failures", sa.Integer, nullable=False),
        sa.Column("first_failure_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("login_attempts")
    op.drop_column("users", "must_change_password")
