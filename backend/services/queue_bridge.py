"""
Python HTTP bridge for Next.js → Celery communication.

Next.js API routes call this FastAPI micro-server to:
  - Enqueue Celery tasks (POST /queue/*)
  - Query task status (GET /queue/status/{job_id})

Running: uvicorn backend.services.queue_bridge:app --port 8001
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.tasks.celery_app import celery_app
from backend.tasks.tasks import (
    generate_insights_task,
    generate_proof_task,
    process_sale_task,
)
from backend.utils.logger import get_logger

logger = get_logger(__name__)

app = FastAPI(
    title="BlueSME Queue Bridge",
    description="Internal HTTP bridge between Next.js and Celery",
    version="1.0.0",
    docs_url="/docs" if os.getenv("DEBUG", "0") == "1" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server only
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Request models ────────────────────────────────────────────────────────────

class LogSaleBody(BaseModel):
    smeAddress: str
    saleMessage: str


class RunInsightsBody(BaseModel):
    smeAddress: str
    isWeekEnd: bool = False


class GenerateProofBody(BaseModel):
    smeAddress: str
    smeName: str
    smeCategory: str = "Blue Economy SME"
    days: int = 90


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "bluesme-queue-bridge"}


@app.post("/queue/log-sale")
async def queue_log_sale(body: LogSaleBody):
    task = process_sale_task.apply_async(
        kwargs={"sme_address": body.smeAddress, "sale_message": body.saleMessage},
        queue="sale_queue",
    )
    logger.info(f"Queued log_sale job: {task.id}")
    return {"job_id": task.id, "status": "queued"}


@app.post("/queue/run-insights")
async def queue_run_insights(body: RunInsightsBody):
    task = generate_insights_task.apply_async(
        kwargs={"sme_address": body.smeAddress, "is_week_end": body.isWeekEnd},
        queue="insights_queue",
    )
    logger.info(f"Queued run_insights job: {task.id}")
    return {"job_id": task.id, "status": "queued"}


@app.post("/queue/generate-proof")
async def queue_generate_proof(body: GenerateProofBody):
    task = generate_proof_task.apply_async(
        kwargs={
            "sme_address": body.smeAddress,
            "sme_name": body.smeName,
            "sme_category": body.smeCategory,
            "days": body.days,
        },
        queue="proof_queue",
    )
    logger.info(f"Queued generate_proof job: {task.id}")
    return {"job_id": task.id, "status": "queued"}


@app.get("/queue/status/{job_id}")
async def get_job_status(job_id: str):
    """
    Returns task progress and result.

    States: PENDING | STARTED | SUCCESS | FAILURE | RETRY
    """
    result = celery_app.AsyncResult(job_id)
    state = result.state
    info: Any = {}

    if state == "PENDING":
        info = {"message": "Task is waiting in queue"}
    elif state == "STARTED":
        info = {"message": "Task is currently running"}
    elif state == "SUCCESS":
        info = result.result or {}
    elif state == "FAILURE":
        info = {
            "error": str(result.result),
            "message": "Task failed — see error details",
        }
    elif state == "RETRY":
        info = {"message": "Task is being retried"}

    return {
        "job_id": job_id,
        "status": state.lower(),
        "result": info,
        "ready": result.ready(),
        "successful": result.successful() if result.ready() else None,
    }
