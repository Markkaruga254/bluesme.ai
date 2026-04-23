"""
Structured logging for BlueSME backend.

Uses Python's standard `logging` with JSON-formatted output for production
and human-readable format for development/test mode.

All loguru-compatible patterns are supported via the standard library adapter.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import traceback
from datetime import datetime, timezone
from typing import Any


# ── Formatters ────────────────────────────────────────────────────────────────

class JSONFormatter(logging.Formatter):
    """Outputs structured JSON log lines — ideal for log aggregators."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        # Merge any extra fields attached by the caller
        if hasattr(record, "extra"):
            log_entry.update(record.extra)
        return json.dumps(log_entry, ensure_ascii=False)


class PrettyFormatter(logging.Formatter):
    """Human-readable formatter for local development."""

    COLOURS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[35m",
    }
    RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        colour = self.COLOURS.get(record.levelname, "")
        ts = datetime.now(timezone.utc).strftime("%H:%M:%S")
        base = (
            f"{colour}[{ts}] {record.levelname:<8}{self.RESET} "
            f"\033[90m{record.name}\033[0m  {record.getMessage()}"
        )
        if record.exc_info:
            base += "\n" + self.formatException(record.exc_info)
        return base


# ── Root setup ────────────────────────────────────────────────────────────────

def _configure_root_logger() -> None:
    """Configure the root logger once at import time."""
    root = logging.getLogger()

    if root.handlers:
        return  # Already configured (e.g., by Celery or pytest)

    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)
    root.setLevel(log_level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(log_level)

    use_json = os.getenv("LOG_FORMAT", "pretty").lower() == "json"
    handler.setFormatter(JSONFormatter() if use_json else PrettyFormatter())
    root.addHandler(handler)


_configure_root_logger()


# ── Public API ────────────────────────────────────────────────────────────────

def get_logger(name: str) -> logging.Logger:
    """Return a named logger. Use __name__ for module-level loggers."""
    return logging.getLogger(name)


class AgentStepLogger:
    """
    Contextual logger for tracking individual agent steps within a flow.
    Attaches job_id and sme_address to every log record.
    """

    def __init__(self, flow_type: str, job_id: str, sme_address: str = ""):
        self._logger = get_logger(f"bluesme.agent.{flow_type}")
        self._job_id = job_id
        self._sme_address = sme_address
        self._flow_type = flow_type

    def _log(self, level: int, message: str, **kwargs: Any) -> None:
        extra = {
            "job_id": self._job_id,
            "sme_address": self._sme_address,
            "flow_type": self._flow_type,
            **kwargs,
        }
        self._logger.log(level, message, extra={"extra": extra})

    def info(self, msg: str, **kw: Any) -> None:
        self._log(logging.INFO, msg, **kw)

    def warning(self, msg: str, **kw: Any) -> None:
        self._log(logging.WARNING, msg, **kw)

    def error(self, msg: str, **kw: Any) -> None:
        self._log(logging.ERROR, msg, **kw)

    def debug(self, msg: str, **kw: Any) -> None:
        self._log(logging.DEBUG, msg, **kw)

    def step(self, step_name: str, status: str = "ok", **kw: Any) -> None:
        self._log(logging.INFO, f"[STEP] {step_name} → {status}", step=step_name, step_status=status, **kw)
