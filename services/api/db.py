"""Database connection.

The address of the database comes only from the environment variable DATABASE_URL.
Locally it is read from services/api/.env (git-ignored); in CI and Docker it is set directly.
A value already in the environment always wins over the file.
"""

import os
from collections.abc import Iterator
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

load_dotenv(Path(__file__).parent / ".env", override=False)


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Set it in the environment or in services/api/.env, "
            "e.g. postgresql+psycopg://<user>:<password>@localhost:5432/mlops"
        )
    return url


def make_engine(url: str | None = None) -> Engine:
    return create_engine(url or get_database_url(), pool_pre_ping=True)


def make_session_factory(engine: Engine) -> sessionmaker:
    return sessionmaker(bind=engine, expire_on_commit=False)


_session_factory: sessionmaker | None = None


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one database session per request (engine created on first use)."""
    global _session_factory
    if _session_factory is None:
        _session_factory = make_session_factory(make_engine())
    with _session_factory() as session:
        yield session
