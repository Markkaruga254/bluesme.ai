"""
Input/output validators for BlueSME.

Implements strict Pydantic schema validation with retry-safe helpers.
All agent outputs MUST pass these validators before being stored in the DB.
"""

from __future__ import annotations

import json
import re
from typing import Any, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from backend.utils.logger import get_logger

logger = get_logger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

VALID_ACTIVITY_TYPES = {"sale", "expense", "weekly_summary"}
VALID_CATEGORIES = {"fisheries", "marine_tourism", "boat_operations", "aquaculture", "other"}
VALID_PAYMENT_TYPES = {"cash", "mpesa", "bank", "other"}
ETH_ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
TX_HASH_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")


# ── Request schemas ───────────────────────────────────────────────────────────

class LogSaleRequest(BaseModel):
    """Validated input for POST /api/log-sale"""
    smeAddress: str = Field(..., min_length=42, max_length=42)
    saleMessage: str = Field(..., min_length=5, max_length=2000)

    @field_validator("smeAddress")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not ETH_ADDRESS_RE.match(v):
            raise ValueError("smeAddress must be a valid Ethereum address (0x + 40 hex chars)")
        return v.lower()


class RunInsightsRequest(BaseModel):
    """Validated input for POST /api/run-insights"""
    smeAddress: str = Field(..., min_length=42, max_length=42)
    isWeekEnd: bool = False

    @field_validator("smeAddress")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not ETH_ADDRESS_RE.match(v):
            raise ValueError("smeAddress must be a valid Ethereum address")
        return v.lower()


class GenerateProofRequest(BaseModel):
    """Validated input for POST /api/generate-proof"""
    smeAddress: str = Field(..., min_length=42, max_length=42)
    smeName: str = Field(..., min_length=2, max_length=255)
    smeCategory: str = Field(default="Blue Economy SME", max_length=100)
    days: int = Field(default=90, ge=1, le=365)

    @field_validator("smeAddress")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not ETH_ADDRESS_RE.match(v):
            raise ValueError("smeAddress must be a valid Ethereum address")
        return v.lower()

    @field_validator("days")
    @classmethod
    def validate_days(cls, v: int) -> int:
        if v not in (30, 60, 90):
            raise ValueError("days must be 30, 60, or 90")
        return v


# ── Agent output schemas ──────────────────────────────────────────────────────

class SaleAgentOutput(BaseModel):
    """Strict schema for Sales Agent's JSON output."""
    event: str = Field(default="deal_confirmed")
    activity_type: str = Field(default="sale")
    amount: int = Field(..., gt=0, le=10_000_000)
    description: str = Field(..., min_length=3, max_length=500)
    category: str
    sme_address: str

    @field_validator("activity_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        if v not in VALID_ACTIVITY_TYPES:
            raise ValueError(f"activity_type must be one of {VALID_ACTIVITY_TYPES}")
        return v

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            # Attempt fuzzy normalization
            lower = v.lower().replace(" ", "_")
            if lower in VALID_CATEGORIES:
                return lower
            raise ValueError(f"category must be one of {VALID_CATEGORIES}")
        return v

    @field_validator("sme_address")
    @classmethod
    def validate_address(cls, v: str) -> str:
        if not ETH_ADDRESS_RE.match(v):
            raise ValueError("sme_address is not a valid Ethereum address")
        return v.lower()


class InsightAgentOutput(BaseModel):
    """Strict schema for Insights Agent's JSON output."""
    net_profit: int
    summary_text: str = Field(..., min_length=5, max_length=1000)
    primary_category: str
    insights: list[str] = Field(default_factory=list)

    @field_validator("insights")
    @classmethod
    def limit_insights(cls, v: list[str]) -> list[str]:
        return v[:5]  # max 5 insight bullets


class ProofReportOutput(BaseModel):
    """Structured proof report extracted from generate_proof_tool output."""
    sme_name: str
    sme_address: str
    period_days: int
    net_revenue: int
    total_sales: int
    total_expenses: int
    tx_count: int
    sales_count: int
    expense_count: int
    profit_margin_pct: float
    verifier_url: Optional[str] = None
    basescan_url: Optional[str] = None


# ── Extraction helpers ────────────────────────────────────────────────────────

def extract_json_from_text(text: str) -> Optional[dict[str, Any]]:
    """
    Extract the first valid JSON object from a blob of text.
    Agent LLM outputs often include preamble/markdown before the JSON.

    Returns the parsed dict or None if no valid JSON found.
    """
    # 1. Try the whole string first
    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        pass

    # 2. Find JSON between ```json ... ``` fences
    fence_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
    if fence_match:
        try:
            return json.loads(fence_match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Find the last {...} block in the text (greedy)
    brace_match = re.search(r"\{[\s\S]*\}", text)
    if brace_match:
        try:
            return json.loads(brace_match.group(0))
        except json.JSONDecodeError:
            pass

    return None


def validate_sale_output(raw: str) -> SaleAgentOutput:
    """
    Parse and validate Sales Agent output.
    Raises ValueError with a clear message if validation fails.
    """
    data = extract_json_from_text(raw)
    if not data:
        raise ValueError(f"Sales agent returned non-JSON output: {raw[:200]}")
    try:
        return SaleAgentOutput(**data)
    except Exception as exc:
        raise ValueError(f"Sales agent output failed schema validation: {exc}") from exc


def validate_insights_output(raw: str) -> InsightAgentOutput:
    """Parse and validate Insights Agent output."""
    data = extract_json_from_text(raw)
    if not data:
        # Fallback: construct a minimal valid output
        logger.warning("Insights agent returned non-JSON; using fallback output")
        return InsightAgentOutput(
            net_profit=0,
            summary_text=raw[:200] if raw else "Insights unavailable",
            primary_category="fisheries",
            insights=[],
        )
    try:
        return InsightAgentOutput(**data)
    except Exception as exc:
        logger.warning(f"Insights schema validation failed ({exc}); using fallback")
        return InsightAgentOutput(
            net_profit=data.get("net_profit", 0),
            summary_text=data.get("summary_text", raw[:200]),
            primary_category=data.get("primary_category", "fisheries"),
            insights=data.get("insights", []),
        )


def extract_tx_hash(text: str) -> Optional[str]:
    """Extract the first valid 0x-prefixed 64-hex-char transaction hash from text."""
    match = TX_HASH_RE.search(text)
    return match.group(0).lower() if match else None
