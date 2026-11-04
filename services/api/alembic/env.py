"""Alembic runs this file for every migration command.

The URL comes from the alembic config if a caller set one (db_check.py and the tests point it at a
throwaway database); otherwise from DATABASE_URL via db.get_database_url().
"""

from alembic import context

from db import get_database_url, make_engine
from models import Base

config = context.config
target_metadata = Base.metadata


def run_migrations_online() -> None:
    url = config.get_main_option("sqlalchemy.url") or get_database_url()
    engine = make_engine(url)
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


run_migrations_online()
