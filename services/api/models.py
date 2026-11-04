"""Database tables as Python classes (SQLAlchemy ORM).

Alembic migrations in alembic/versions/ create these tables; the classes are how the API reads them.
"""

from datetime import datetime

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    false,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


EXPERIMENT_SOURCES = ("demo", "training")


class Experiment(Base):
    """One training run. source 'training' = recorded from a real run folder (record_run.py);
    'demo' = the invented seed rows."""

    __tablename__ = "experiments"
    __table_args__ = (CheckConstraint("source IN ('demo', 'training')", name="experiments_source_check"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    status: Mapped[str] = mapped_column(String(20))  # running | completed | failed
    accuracy: Mapped[float | None] = mapped_column(Float)  # balanced accuracy on the test split
    loss: Mapped[float | None] = mapped_column(Float)
    epochs: Mapped[int] = mapped_column(Integer)
    precision: Mapped[float | None] = mapped_column(Float)  # macro mean over classes with support > 0
    recall: Mapped[float | None] = mapped_column(Float)
    f1: Mapped[float | None] = mapped_column(Float)
    duration_seconds: Mapped[float | None] = mapped_column(Float)
    parameters: Mapped[dict | None] = mapped_column(JSON)
    dataset_kind: Mapped[str | None] = mapped_column(String(20))  # dev = not a valid performance estimate
    model_version: Mapped[str | None] = mapped_column(String(40))
    source: Mapped[str] = mapped_column(String(20), server_default="demo")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Model(Base):
    """One version of a model; the model is its name. source 'training' = registered by record_run.py
    from a real run folder; 'demo' = the invented seed rows."""

    __tablename__ = "models"
    __table_args__ = (CheckConstraint("source IN ('demo', 'training')", name="models_source_check"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    version: Mapped[str] = mapped_column(String(20))
    framework: Mapped[str] = mapped_column(String(40))
    accuracy: Mapped[float | None] = mapped_column(Float)
    stage: Mapped[str] = mapped_column(String(20))  # staging | production | archived
    experiment_id: Mapped[int | None] = mapped_column(ForeignKey("experiments.id"))
    description: Mapped[str | None] = mapped_column(String(500))
    size_bytes: Mapped[int | None] = mapped_column(BigInteger)  # of model.pt
    stage_changed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))  # set by API-008
    source: Mapped[str] = mapped_column(String(20), server_default="demo")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Deployment(Base):
    __tablename__ = "deployments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    environment: Mapped[str] = mapped_column(String(20))  # staging | production
    status: Mapped[str] = mapped_column(String(20))  # healthy | degraded | stopped
    model_id: Mapped[int] = mapped_column(ForeignKey("models.id"))
    replicas: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PredictionLog(Base):
    """One /predict or /explain answer, errors included (prediction_log.py, API-009). Only numbers
    measured on the scan are stored (scan_stats.py), never the scan itself."""

    __tablename__ = "predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    path: Mapped[str] = mapped_column(String(20))  # /predict | /explain
    status: Mapped[int] = mapped_column(Integer)
    latency_ms: Mapped[float] = mapped_column(Float)
    model_version: Mapped[str | None] = mapped_column(String(40))
    predicted_class: Mapped[str | None] = mapped_column(String(40))
    confidence: Mapped[float | None] = mapped_column(Float)
    mean: Mapped[float | None] = mapped_column(Float)
    std: Mapped[float | None] = mapped_column(Float)
    width: Mapped[float | None] = mapped_column(Float)
    height: Mapped[float | None] = mapped_column(Float)


ROLES = ("admin", "ml_engineer")


class User(Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('admin', 'ml_engineer')", name="users_role_check"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20))
    password_hash: Mapped[str] = mapped_column(String(255))
    # True for users an admin creates: they must choose their own password before using the API.
    must_change_password: Mapped[bool] = mapped_column(Boolean, server_default=false(), default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LoginAttempt(Base):
    """Wrong passwords per email, for the failed-login lockout.

    email_key is an HMAC of the normalised email, so unknown emails can be counted without storing them.
    """

    __tablename__ = "login_attempts"

    email_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    failures: Mapped[int] = mapped_column(Integer)
    first_failure_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AuthSession(Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    """A message for one user. It is read once read_at is set."""

    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
