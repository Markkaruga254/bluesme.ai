"""
Celery application configuration for BlueSME.

Broker: Redis (reliable, fast, supports pub/sub for job progress)
Result backend: Redis (stores task results for GET /api/job-status)

All worker processes inherit this config via `celery_app.conf`.
"""

from __future__ import annotations

import os

from celery import Celery
from celery.signals import task_failure, task_postrun, task_prerun, worker_ready
from kombu import Queue

from backend.utils.logger import get_logger

logger = get_logger(__name__)

# ── Redis URLs ────────────────────────────────────────────────────────────────

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

# ── Celery app ────────────────────────────────────────────────────────────────

celery_app = Celery(
    "bluesme",
    broker=REDIS_URL,
    backend=RESULT_BACKEND,
    include=["backend.tasks.tasks"],
)

# ── Configuration ─────────────────────────────────────────────────────────────

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",

    # Timezone
    timezone="Africa/Nairobi",
    enable_utc=True,

    # Result storage: keep results for 24 hours
    result_expires=86400,

    # Task behaviour
    task_acks_late=True,            # ack only after task completes (safer for retries)
    task_reject_on_worker_lost=True,
    task_track_started=True,        # enables STARTED state (visible in job-status)
    worker_prefetch_multiplier=1,   # one task per worker at a time (fair distribution)

    # Concurrency — tune via env for prod
    worker_concurrency=int(os.getenv("CELERY_CONCURRENCY", "4")),

    # Queues — separate queue per task type for priority routing
    task_queues=(
        Queue("sale_queue",    routing_key="sale"),
        Queue("insights_queue", routing_key="insights"),
        Queue("proof_queue",   routing_key="proof"),
        Queue("blockchain_queue", routing_key="blockchain"),
        Queue("reconcile_queue", routing_key="reconcile"),
        Queue("default",       routing_key="default"),
    ),
    task_default_queue="default",
    task_routes={
        "backend.tasks.tasks.process_sale_task":             {"queue": "sale_queue"},
        "backend.tasks.tasks.generate_insights_task":        {"queue": "insights_queue"},
        "backend.tasks.tasks.generate_proof_task":           {"queue": "proof_queue"},
        "backend.tasks.tasks.blockchain_log_task":           {"queue": "blockchain_queue"},
        "backend.tasks.tasks.reconcile_transactions_task":   {"queue": "reconcile_queue"},
    },

    # Retry limits
    task_max_retries=3,
    task_soft_time_limit=180,       # 3 min soft limit → raises SoftTimeLimitExceeded
    task_time_limit=240,            # 4 min hard limit → kills worker process

    # Beat schedule (optional scheduler)
    beat_schedule={
        "run-reconciliation-periodically": {
            "task": "backend.tasks.tasks.reconcile_transactions_task",
            "schedule": float(os.getenv("RECONCILIATION_INTERVAL_MINUTES", "5")) * 60.0,
            "args": (None,),  # Pass None for sme_address to scan ALL
        },
    },
)


# ── Signals ───────────────────────────────────────────────────────────────────

@worker_ready.connect
def on_worker_ready(sender, **kwargs):
    logger.info(f"BlueSME Celery worker ready. Broker: {REDIS_URL}")


@task_prerun.connect
def on_task_prerun(task_id, task, args, kwargs, **_):
    logger.info(f"[TASK START] {task.name} | id={task_id}")


@task_postrun.connect
def on_task_postrun(task_id, task, retval, state, **_):
    logger.info(f"[TASK DONE]  {task.name} | id={task_id} | state={state}")


@task_failure.connect
def on_task_failure(task_id, exception, traceback, sender, **_):
    logger.error(
        f"[TASK FAIL]  {sender.name} | id={task_id} | error={exception}",
        exc_info=True,
    )
