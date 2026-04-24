"""
Database session management for BlueSME.

Usage:
    from backend.db.session import get_db, engine

    # In a Celery task / regular code:
    with get_db() as db:
        db.add(some_model)
        db.commit()

    # With dependency injection style:
    db = next(get_db_generator())
"""

from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import NullPool, QueuePool

from backend.db.models import Base
from backend.utils.logger import get_logger

logger = get_logger(__name__)

# ── Engine configuration ──────────────────────────────────────────────────────

def _build_database_url() -> str:
    """
    Construct the database URL from individual env vars or a single DSN.
    Supports both formats for flexibility.
    """
    dsn = os.getenv("DATABASE_URL")
    if dsn:
        # SQLAlchemy 2.x needs 'postgresql+psycopg2://' not 'postgres://'
        return dsn.replace("postgres://", "postgresql+psycopg2://", 1)

    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    user = os.getenv("POSTGRES_USER", "bluesme")
    password = os.getenv("POSTGRES_PASSWORD", "bluesme_secret")
    db = os.getenv("POSTGRES_DB", "bluesme")
    return f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}"


DATABASE_URL = _build_database_url()

# Use NullPool for Celery workers (forked processes) to avoid connection sharing.
# Switch to QueuePool for the API server via BLUESME_USE_POOL=1.
_use_pool = os.getenv("BLUESME_USE_POOL", "0") == "1"

_pool_kwargs: dict = (
    {"pool_size": 10, "max_overflow": 20}
    if _use_pool
    else {}
)

engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool if _use_pool else NullPool,
    pool_pre_ping=True,          # detect stale connections
    echo=os.getenv("SQLALCHEMY_ECHO", "0") == "1",
    future=True,
    **_pool_kwargs,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    expire_on_commit=False,
)


# ── Context manager ───────────────────────────────────────────────────────────

@contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Thread-safe context manager that yields a SQLAlchemy Session.
    Automatically commits on success, rolls back on any exception.

    Example:
        with get_db() as db:
            db.add(my_record)
            # commit happens automatically
    """
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db_generator() -> Generator[Session, None, None]:
    """
    Generator-style session provider for dependency injection patterns.
    Compatible with FastAPI Depends() if added later.
    """
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ── Schema initialization ─────────────────────────────────────────────────────

def init_db() -> None:
    """
    Create all tables if they do not exist.
    Safe to call on every startup — DDL is idempotent (CREATE IF NOT EXISTS).
    """
    logger.info("Initializing database schema…")
    Base.metadata.create_all(bind=engine)
    logger.info("Database schema ready.")


def check_connection() -> bool:
    """Verify that the database is reachable. Returns True on success."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.error(f"Database connection check failed: {exc}")
        return False
