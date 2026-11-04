"""notifications table, with demo notifications for the two demo users

- notifications: one row per message for one user (user_id → users.id, deleted with the user).
  A notification is read once read_at is set; read_at stays null while it is unread.
- Seed: each demo user (looked up by email, created in 0003) gets 2 unread and 1 read notification.
  Invented demo text for the brain-MRI use case (docs/product.md); no real events.

Revision ID: 0005
Revises: 0004
"""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

# (email, title, message, age in minutes, read)
DEMO_NOTIFICATIONS = [
    ("admin@mlops.local", "Staging deployment degraded",
     "alzheimer-api-staging reports degraded health. Check its replicas and recent logs.", 10, False),
    ("admin@mlops.local", "New model version in staging",
     "alzheimer-resnet18 0.1.0 was registered in the staging stage.", 120, False),
    ("admin@mlops.local", "Welcome to MLOps Dashboard",
     "You are signed in as an admin. You can create users from the admin page.", 1440, True),
    ("engineer@mlops.local", "Experiment failed",
     "cnn-dropout-sweep stopped with status failed. Review its settings before running it again.", 15, False),
    ("engineer@mlops.local", "Experiment still running",
     "resnet18-transfer-mri is running. Accuracy and loss appear when it completes.", 90, False),
    ("engineer@mlops.local", "Welcome to MLOps Dashboard",
     "You are signed in as an ML engineer. Your experiments, models and deployments are in the sidebar.", 1440, True),
]

SEED = sa.text(
    "INSERT INTO notifications (user_id, title, message, created_at, read_at) "
    "SELECT u.id, :title, :message, now() - make_interval(mins => :age), "
    "CASE WHEN :read THEN now() - make_interval(mins => :age) + interval '5 minutes' END "
    "FROM users u WHERE u.email = :email"
)


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(120), nullable=False),
        sa.Column("message", sa.String(500), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])

    bind = op.get_bind()
    for email, title, message, age, read in DEMO_NOTIFICATIONS:
        bind.execute(SEED, {"email": email, "title": title, "message": message, "age": age, "read": read})


def downgrade() -> None:
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_table("notifications")
