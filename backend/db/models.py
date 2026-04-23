"""
SQLAlchemy ORM models for BlueSME production backend.

Tables:
  - SMEs             — registered SME profiles
  - Transactions     — individual sale / expense records
  - Insights         — AI-generated daily/weekly insight reports
  - Proofs           — generated funding proof records
  - AgentLogs        — full audit trail of every agent/flow execution
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import func


# ── UTC-aware helper ──────────────────────────────────────────────────────────

def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ── Base class ────────────────────────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ── SMEs ──────────────────────────────────────────────────────────────────────

class SME(Base):
    """Registered SME profile. Wallet address is the canonical identifier."""

    __tablename__ = "smes"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        nullable=False,
    )
    name = Column(String(255), nullable=False)
    category = Column(
        Enum(
            "fisheries",
            "marine_tourism",
            "boat_operations",
            "aquaculture",
            "other",
            name="sme_category_enum",
        ),
        nullable=False,
        default="fisheries",
    )
    wallet_address = Column(String(42), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=_utcnow,
        default=_utcnow,
    )

    # Relationships
    transactions = relationship("Transaction", back_populates="sme", lazy="dynamic")
    insights = relationship("Insight", back_populates="sme", lazy="dynamic")
    proofs = relationship("Proof", back_populates="sme", lazy="dynamic")

    def __repr__(self) -> str:
        return f"<SME {self.name} [{self.wallet_address[:10]}…]>"


# ── Transactions ──────────────────────────────────────────────────────────────

class Transaction(Base):
    """
    Individual sale or expense record.

    Idempotency: (sme_id, product, quantity, unit, amount, created_at::date)
    is enforced at the application layer to prevent double-logging.
    tx_hash is nullable until the blockchain confirmation completes.
    """

    __tablename__ = "transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    sme_id = Column(
        UUID(as_uuid=True),
        ForeignKey("smes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    activity_type = Column(
        Enum("sale", "expense", "weekly_summary", name="activity_type_enum"),
        nullable=False,
        default="sale",
    )
    product = Column(String(255), nullable=False, default="")
    quantity = Column(Numeric(12, 3), nullable=True)
    unit = Column(String(50), nullable=True)          # kg, litre, trip, etc.
    amount = Column(Integer, nullable=False)           # KES, whole number
    payment_type = Column(
        Enum("cash", "mpesa", "bank", "other", name="payment_type_enum"),
        nullable=False,
        default="cash",
    )
    category = Column(
        Enum(
            "fisheries",
            "marine_tourism",
            "boat_operations",
            "aquaculture",
            "other",
            name="tx_category_enum",
        ),
        nullable=False,
        default="fisheries",
    )
    description = Column(Text, nullable=False, default="")
    raw_input = Column(Text, nullable=True)           # original SME message
    tx_hash = Column(String(66), nullable=True, index=True)   # 0x + 64 hex chars
    blockchain_confirmed = Column(Boolean, nullable=False, default=False)
    idempotency_key = Column(String(64), nullable=True, unique=True, index=True)
    job_id = Column(String(255), nullable=True, index=True)   # Celery job ID
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
    )

    # Relationships
    sme = relationship("SME", back_populates="transactions")

    def __repr__(self) -> str:
        return f"<Transaction {self.activity_type} KES {self.amount} [{self.id}]>"


# ── Insights ──────────────────────────────────────────────────────────────────

class Insight(Base):
    """AI-generated daily or weekly insight report for an SME."""

    __tablename__ = "insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    sme_id = Column(
        UUID(as_uuid=True),
        ForeignKey("smes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    insight_type = Column(
        Enum("daily", "weekly", name="insight_type_enum"),
        nullable=False,
        default="daily",
    )
    is_weekend = Column(Boolean, nullable=False, default=False)
    content = Column(JSONB, nullable=False, default=dict)   # structured AI output
    raw_output = Column(Text, nullable=True)                # full LLM response
    net_profit = Column(Integer, nullable=True)
    primary_category = Column(String(100), nullable=True)
    job_id = Column(String(255), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
    )

    # Relationships
    sme = relationship("SME", back_populates="insights")

    def __repr__(self) -> str:
        return f"<Insight {self.insight_type} for SME {self.sme_id} [{self.created_at}]>"


# ── Proofs ────────────────────────────────────────────────────────────────────

class Proof(Base):
    """Generated funding proof report for lenders / grant officers."""

    __tablename__ = "proofs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    sme_id = Column(
        UUID(as_uuid=True),
        ForeignKey("smes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sme_name = Column(String(255), nullable=False)
    sme_category = Column(String(100), nullable=False)
    period_days = Column(Integer, nullable=False, default=90)
    start_date = Column(DateTime(timezone=True), nullable=False)
    end_date = Column(DateTime(timezone=True), nullable=False)
    net_revenue = Column(Integer, nullable=False, default=0)     # KES
    total_sales = Column(Integer, nullable=False, default=0)     # KES
    total_expenses = Column(Integer, nullable=False, default=0)  # KES
    tx_count = Column(Integer, nullable=False, default=0)
    sales_count = Column(Integer, nullable=False, default=0)
    expense_count = Column(Integer, nullable=False, default=0)
    profit_margin_pct = Column(Numeric(5, 2), nullable=True)
    proof_hash = Column(String(66), nullable=True)               # optional on-chain hash
    full_report = Column(JSONB, nullable=True)                   # complete JSON report
    qr_code_path = Column(String(500), nullable=True)
    job_id = Column(String(255), nullable=True, index=True)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
    )

    # Relationships
    sme = relationship("SME", back_populates="proofs")

    def __repr__(self) -> str:
        return f"<Proof {self.period_days}d KES {self.net_revenue} [{self.id}]>"


# ── AgentLogs ─────────────────────────────────────────────────────────────────

class AgentLog(Base):
    """
    Full audit trail of every agent flow execution.
    Stores input, output, status, and timing for observability.
    """

    __tablename__ = "agent_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, nullable=False)
    flow_type = Column(
        Enum(
            "log_sale",
            "run_insights",
            "generate_proof",
            "blockchain_log",
            name="flow_type_enum",
        ),
        nullable=False,
        index=True,
    )
    job_id = Column(String(255), nullable=True, index=True)  # Celery task ID
    sme_address = Column(String(42), nullable=True, index=True)
    input_payload = Column(JSONB, nullable=True)
    output_payload = Column(JSONB, nullable=True)
    raw_output = Column(Text, nullable=True)
    status = Column(
        Enum("pending", "running", "success", "failure", name="log_status_enum"),
        nullable=False,
        default="pending",
        index=True,
    )
    error_message = Column(Text, nullable=True)
    duration_ms = Column(Integer, nullable=True)   # wall-clock time in milliseconds
    retry_count = Column(Integer, nullable=False, default=0)
    test_mode = Column(Boolean, nullable=False, default=False)
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        default=_utcnow,
        index=True,
    )
    completed_at = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self) -> str:
        return f"<AgentLog {self.flow_type} [{self.status}] job={self.job_id}>"
