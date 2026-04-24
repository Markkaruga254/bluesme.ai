"""
Celery task definitions for BlueSME.

Each task:
  1. Creates an AgentLog entry (status=running)
  2. Calls the appropriate CrewAI flow
  3. Validates + stores the output in PostgreSQL
  4. Updates AgentLog (status=success or failure)
  5. Returns a structured JSON-serialisable result dict

All tasks are retryable with exponential back-off.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from celery import Task
from celery.exceptions import SoftTimeLimitExceeded

from backend.tasks.celery_app import celery_app
from backend.db.session import get_db
from backend.db.models import AgentLog, Insight, Proof, SME, Transaction
from backend.utils.logger import get_logger, AgentStepLogger
from backend.utils.validators import (
    validate_sale_output,
    validate_insights_output,
    extract_tx_hash,
)

logger = get_logger(__name__)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _is_test_mode() -> bool:
    return os.getenv("BLUESME_TEST_MODE", "0") == "1"


def _run_python_flow(flow_name: str, payload: dict) -> dict:
    """
    Execute a CrewAI flow by invoking the existing scripts/run_flow.py runner.
    This keeps the Node.js ↔ Python bridge pattern but moves execution into
    Celery workers (out of the Next.js request thread).

    Returns parsed dict: { ok, output, testMode } or { ok, error }
    """
    import subprocess
    import sys

    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    runner = os.path.join(project_root, "scripts", "run_flow.py")

    # Resolve Python interpreter: prefer venv
    python_candidates = [
        os.path.join(project_root, "venv", "bin", "python"),
        os.path.join(project_root, ".venv", "bin", "python"),
        os.getenv("BLUESME_PYTHON", "python3"),
        "python3",
        "python",
    ]
    python_exe = next(
        (p for p in python_candidates if os.path.isfile(p)),
        python_candidates[-1],
    )

    env = {**os.environ, "BLUESME_TEST_MODE": "1" if _is_test_mode() else "0"}

    result = subprocess.run(
        [python_exe, runner, flow_name, json.dumps(payload)],
        capture_output=True,
        text=True,
        timeout=180,
        cwd=project_root,
        env=env,
    )

    stdout = result.stdout.strip()
    # CrewAI prints logs before our JSON — extract the last {...}
    json_match = None
    for m in __import__("re").finditer(r"\{[\s\S]*\}", stdout):
        json_match = m
    if json_match:
        stdout = json_match.group(0)

    try:
        return json.loads(stdout)
    except json.JSONDecodeError:
        return {"ok": False, "error": f"Invalid JSON from runner: {stdout[:300]}"}


def _get_or_create_sme(db, sme_address: str, name: str = "Unknown SME",
                        category: str = "fisheries") -> SME:
    """
    Return existing SME by wallet_address or create a new one.
    This ensures idempotency — we never insert duplicate SME rows.
    """
    sme = db.query(SME).filter_by(wallet_address=sme_address.lower()).first()
    if not sme:
        sme = SME(
            name=name,
            category=category if category in {
                "fisheries", "marine_tourism", "boat_operations", "aquaculture", "other"
            } else "other",
            wallet_address=sme_address.lower(),
        )
        db.add(sme)
        db.flush()  # populate sme.id before referencing it
    return sme


def _mark_log(db, log: AgentLog, status: str, output: Any = None,
              error: str | None = None, started_at: float | None = None) -> None:
    """Update an AgentLog record with completion info."""
    log.status = status
    log.error_message = error
    log.completed_at = datetime.now(timezone.utc)
    if started_at:
        log.duration_ms = int((time.monotonic() - started_at) * 1000)
    if output:
        if isinstance(output, str):
            log.raw_output = output
            try:
                log.output_payload = json.loads(output)
            except json.JSONDecodeError:
                log.output_payload = {"raw": output}
        elif isinstance(output, dict):
            log.output_payload = output
    db.add(log)


# ── Task 1: process_sale_task ─────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="backend.tasks.tasks.process_sale_task",
    max_retries=3,
    default_retry_delay=5,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=60,
    acks_late=True,
)
def process_sale_task(self: Task, sme_address: str, sale_message: str) -> dict:
    """
    Robust sale processing pipeline:
      1. Idempotency Check (High-res)
      2. Flow Execution (Sales -> Finance)
      3. DB Persistence (Status: pending_blockchain)
      4. ASYNC Blockchain Logging (Post-commit)
    """
    job_id = self.request.id or str(uuid.uuid4())
    step_log = AgentStepLogger("log_sale", job_id, sme_address)
    started_at = time.monotonic()

    step_log.info("Starting sale processing", message_preview=sale_message[:60])

    # ── Step 1: Idempotency Key Generation ──────────────────────────────────
    # We use a hash of the raw message + address + current minute to prevent 
    # rapid-fire accidental duplicates while allowing multiple distinct sales.
    # For production, we would ideally pass a client-side request_id.
    now = datetime.now(timezone.utc)
    timestamp_key = now.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] # millisecond precision
    idem_key = hashlib.sha256(
        f"{sme_address.lower()}:{sale_message}:{timestamp_key}".encode()
    ).hexdigest()

    with get_db() as db:
        # Check if already processed (edge case for task retries)
        existing = db.query(Transaction).filter_by(job_id=job_id).first()
        if existing:
            step_log.warning("Task already processed", job_id=job_id)
            return {"status": existing.status, "transaction_id": str(existing.id), "output": existing.description}

        # Create AgentLog entry
        agent_log = AgentLog(
            flow_type="log_sale",
            job_id=job_id,
            sme_address=sme_address.lower(),
            input_payload={"smeAddress": sme_address, "saleMessage": sale_message},
            status="running",
            test_mode=_is_test_mode(),
        )
        db.add(agent_log)
        db.flush()

        try:
            # ── Step 2: Run Flow ───────────────────────────────────────────
            step_log.step("sale_flow", "running")
            flow_result = _run_python_flow(
                "log_sale",
                {"smeAddress": sme_address, "saleMessage": sale_message},
            )

            if not flow_result.get("ok"):
                raise ValueError(flow_result.get("error", "Flow returned ok=False"))

            raw_output = flow_result.get("output", "")
            step_log.step("sale_flow", "done")

            # ── Step 3: Validate ───────────────────────────────────────────
            sale_data = validate_sale_output(raw_output)

            # ── Step 4: Persist (Status: pending_blockchain) ───────────────
            step_log.step("persist_transaction", "running")
            sme = _get_or_create_sme(db, sme_address)

            tx = Transaction(
                sme_id=sme.id,
                activity_type=sale_data.activity_type,
                product=sale_data.description[:100],
                amount=sale_data.amount,
                payment_type="cash",
                category=sale_data.category,
                description=sale_data.description,
                raw_input=sale_message,
                idempotency_key=idem_key,
                job_id=job_id,
                status="pending_blockchain"
            )
            db.add(tx)
            db.flush()
            tx_id = str(tx.id)
            
            _mark_log(db, agent_log, "success", output=raw_output, started_at=started_at)
            step_log.step("persist_transaction", "done", transaction_id=tx_id)

        except Exception as exc:
            db.rollback() # Ensure AgentLog failure is also handled or separate session
            err_msg = str(exc)
            step_log.error(f"Sale processing failed: {err_msg}")
            
            # Rejection path for unresolvable/ambiguous inputs (no retry)
            if isinstance(exc, ValueError) or "Flow returned ok=False" in err_msg:
                with get_db() as fail_db:
                    fail_log = fail_db.query(AgentLog).filter_by(job_id=job_id).first()
                    if fail_log:
                        _mark_log(fail_db, fail_log, "failed_validation", error=err_msg, started_at=started_at)
                return {"status": "rejected", "job_id": job_id, "error": err_msg}
                
            # Transient error -> retry
            raise self.retry(exc=exc)

    # ── Step 5: Enqueue Blockchain Log (OUTSIDE DB Transaction) ────────────
    # This fixes the Race Condition. The DB transaction is definitely committed now.
    step_log.step("enqueue_blockchain", "running")
    blockchain_log_task.apply_async(
        kwargs={
            "transaction_id": tx_id,
            "sme_address": sme_address,
            "activity_type": sale_data.activity_type,
            "amount": sale_data.amount,
            "description": sale_data.description,
            "category": sale_data.category,
        },
        queue="blockchain_queue"
    )
    step_log.step("enqueue_blockchain", "queued")

    return {
        "status": "pending_blockchain",
        "job_id": job_id,
        "transaction_id": tx_id,
        "amount": sale_data.amount,
        "testMode": _is_test_mode(),
    }


# ── Task 2: generate_insights_task ───────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="backend.tasks.tasks.generate_insights_task",
    max_retries=3,
    default_retry_delay=10,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=120,
    acks_late=True,
)
def generate_insights_task(self: Task, sme_address: str, is_week_end: bool = False) -> dict:
    """
    Evening insights pipeline:
      1. Fetch SME's recent transactions from DB
      2. Run EveningInsightsFlow
      3. Validate + store Insight record
    """
    job_id = self.request.id or str(uuid.uuid4())
    step_log = AgentStepLogger("run_insights", job_id, sme_address)
    started_at = time.monotonic()

    step_log.info("Starting insights generation", is_week_end=is_week_end)

    with get_db() as db:
        agent_log = AgentLog(
            flow_type="run_insights",
            job_id=job_id,
            sme_address=sme_address.lower(),
            input_payload={"smeAddress": sme_address, "isWeekEnd": is_week_end},
            status="running",
            test_mode=_is_test_mode(),
        )
        db.add(agent_log)
        db.flush()

        try:
            # ── Step 1: Run EveningInsightsFlow ───────────────────────────
            step_log.step("insights_flow", "running")
            flow_result = _run_python_flow(
                "run_insights",
                {"smeAddress": sme_address, "isWeekEnd": is_week_end},
            )

            if not flow_result.get("ok"):
                raise RuntimeError(flow_result.get("error", "Insights flow returned ok=False"))

            raw_output = flow_result.get("output", "")
            step_log.step("insights_flow", "done", output_preview=raw_output[:80])

            # ── Step 2: Validate ───────────────────────────────────────────
            insight_data = validate_insights_output(raw_output)

            # ── Step 3: Persist Insight ────────────────────────────────────
            step_log.step("persist_insight", "running")
            sme = _get_or_create_sme(db, sme_address)

            insight = Insight(
                sme_id=sme.id,
                insight_type="weekly" if is_week_end else "daily",
                is_weekend=is_week_end,
                content={
                    "net_profit": insight_data.net_profit,
                    "summary_text": insight_data.summary_text,
                    "primary_category": insight_data.primary_category,
                    "insights": insight_data.insights,
                },
                raw_output=raw_output,
                net_profit=insight_data.net_profit,
                primary_category=insight_data.primary_category,
                job_id=job_id,
            )
            db.add(insight)
            db.flush()
            insight_id = str(insight.id)
            step_log.step("persist_insight", "done", insight_id=insight_id)

            result = {
                "status": "success",
                "job_id": job_id,
                "insight_id": insight_id,
                "net_profit": insight_data.net_profit,
                "summary_text": insight_data.summary_text,
                "insights": insight_data.insights,
                "testMode": flow_result.get("testMode", _is_test_mode()),
                "output": raw_output,
            }
            _mark_log(db, agent_log, "success", output=raw_output, started_at=started_at)
            return result

        except SoftTimeLimitExceeded:
            err = "Insights task exceeded time limit"
            step_log.error(err)
            _mark_log(db, agent_log, "failure", error=err, started_at=started_at)
            raise

        except Exception as exc:
            err_msg = str(exc)
            step_log.error(f"Insights generation failed: {err_msg}")
            _mark_log(db, agent_log, "failure", error=err_msg, started_at=started_at)
            raise self.retry(exc=exc)


# ── Task 3: generate_proof_task ──────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="backend.tasks.tasks.generate_proof_task",
    max_retries=2,
    default_retry_delay=15,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=90,
    acks_late=True,
)
def generate_proof_task(
    self: Task,
    sme_address: str,
    sme_name: str,
    sme_category: str,
    days: int = 90,
) -> dict:
    """
    Funding proof pipeline:
      1. Run FundingProofFlow
      2. Extract structured financial data
      3. Persist Proof record to PostgreSQL
    """
    job_id = self.request.id or str(uuid.uuid4())
    step_log = AgentStepLogger("generate_proof", job_id, sme_address)
    started_at = time.monotonic()

    step_log.info("Starting proof generation", days=days, sme_name=sme_name)

    with get_db() as db:
        agent_log = AgentLog(
            flow_type="generate_proof",
            job_id=job_id,
            sme_address=sme_address.lower(),
            input_payload={
                "smeAddress": sme_address,
                "smeName": sme_name,
                "smeCategory": sme_category,
                "days": days,
            },
            status="running",
            test_mode=_is_test_mode(),
        )
        db.add(agent_log)
        db.flush()

        try:
            # ── Step 1: Run FundingProofFlow ───────────────────────────────
            step_log.step("proof_flow", "running")
            flow_result = _run_python_flow(
                "generate_proof",
                {
                    "smeAddress": sme_address,
                    "smeName": sme_name,
                    "smeCategory": sme_category,
                    "days": days,
                },
            )

            if not flow_result.get("ok"):
                raise RuntimeError(flow_result.get("error", "Proof flow returned ok=False"))

            raw_output = flow_result.get("output", "")
            step_log.step("proof_flow", "done", output_length=len(raw_output))

            # ── Step 2: Extract structured data from report ────────────────
            step_log.step("parse_proof", "running")
            from backend.utils.validators import extract_json_from_text

            # Try to find the FULL_REPORT_JSON block
            report_json: dict = {}
            if "FULL_REPORT_JSON:" in raw_output:
                json_part = raw_output.split("FULL_REPORT_JSON:")[-1].strip()
                report_json = extract_json_from_text(json_part) or {}

            fin = report_json.get("financial_summary", {})
            proof_period = report_json.get("funding_proof", {})

            now = datetime.now(timezone.utc)
            from datetime import timedelta
            start_dt = now - timedelta(days=days)

            net_revenue = fin.get("net_profit_kes", 0)
            total_sales = fin.get("total_sales_kes", 0)
            total_expenses = fin.get("total_expenses_kes", 0)
            tx_count = fin.get("transaction_count", 0)
            sales_count = fin.get("sales_count", 0)
            expense_count = fin.get("expense_count", 0)
            profit_margin = fin.get("profit_margin_pct", 0.0)

            step_log.step("parse_proof", "done", net_revenue=net_revenue)

            # ── Step 3: Persist Proof ──────────────────────────────────────
            step_log.step("persist_proof", "running")
            sme = _get_or_create_sme(db, sme_address, name=sme_name, category="fisheries")

            proof = Proof(
                sme_id=sme.id,
                sme_name=sme_name,
                sme_category=sme_category,
                period_days=days,
                start_date=start_dt,
                end_date=now,
                net_revenue=net_revenue,
                total_sales=total_sales,
                total_expenses=total_expenses,
                tx_count=tx_count,
                sales_count=sales_count,
                expense_count=expense_count,
                profit_margin_pct=profit_margin,
                full_report=report_json or None,
                job_id=job_id,
            )
            db.add(proof)
            db.flush()
            proof_id = str(proof.id)
            step_log.step("persist_proof", "done", proof_id=proof_id)

            result = {
                "status": "success",
                "job_id": job_id,
                "proof_id": proof_id,
                "net_revenue": net_revenue,
                "tx_count": tx_count,
                "period_days": days,
                "testMode": flow_result.get("testMode", _is_test_mode()),
                "output": raw_output,
            }
            _mark_log(db, agent_log, "success", output=raw_output, started_at=started_at)
            return result

        except SoftTimeLimitExceeded:
            err = "Proof task exceeded time limit"
            step_log.error(err)
            _mark_log(db, agent_log, "failure", error=err, started_at=started_at)
            raise

        except Exception as exc:
            err_msg = str(exc)
            step_log.error(f"Proof generation failed: {err_msg}")
            _mark_log(db, agent_log, "failure", error=err_msg, started_at=started_at)
            raise self.retry(exc=exc)


# ── Task 4: blockchain_log_task ──────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="backend.tasks.tasks.blockchain_log_task",
    max_retries=5,
    default_retry_delay=10,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    acks_late=True,
)
def blockchain_log_task(
    self: Task,
    transaction_id: str,
    sme_address: str,
    activity_type: str,
    amount: int,
    description: str,
    category: str,
) -> dict:
    """
    Asynchronous blockchain logging task.
    Updated to handle lifecycle status (confirmed/failed).
    """
    job_id = self.request.id or str(uuid.uuid4())
    step_log = AgentStepLogger("blockchain_log", job_id, sme_address)
    started_at = time.monotonic()

    step_log.info("Starting blockchain log", transaction_id=transaction_id)

    with get_db() as db:
        # Check if already confirmed (idempotency for blockchain writes)
        tx_record = db.query(Transaction).filter_by(id=transaction_id).first()
        if not tx_record:
            step_log.error("Transaction not found", transaction_id=transaction_id)
            return {"status": "error", "message": "Transaction record missing"}
        
        if tx_record.blockchain_confirmed:
            step_log.warning("Transaction already confirmed", tx_hash=tx_record.tx_hash)
            return {"status": "already_confirmed", "tx_hash": tx_record.tx_hash}

        agent_log = AgentLog(
            flow_type="blockchain_log",
            job_id=job_id,
            sme_address=sme_address.lower(),
            input_payload={"transaction_id": transaction_id, "amount": amount},
            status="running",
            test_mode=_is_test_mode(),
            retry_count=self.request.retries,
        )
        db.add(agent_log)

        try:
            # ── Blockchain Write ───────────────────────────────────────────
            from contracts.mock_blockchain import log_activity_for

            step_log.step("write_to_chain", "running")
            tx_hash = log_activity_for(
                sme_address, activity_type, amount, description, category
            )
            step_log.step("write_to_chain", "done", tx_hash=tx_hash)

            # ── Finalize Status ────────────────────────────────────────────
            tx_record.tx_hash = tx_hash
            tx_record.blockchain_confirmed = True
            tx_record.status = "confirmed"
            
            result = {
                "status": "success",
                "transaction_id": transaction_id,
                "tx_hash": tx_hash,
                "basescan_url": f"https://sepolia.basescan.org/tx/{tx_hash}",
            }
            _mark_log(db, agent_log, "success", output=result, started_at=started_at)
            return result

        except Exception as exc:
            err_msg = str(exc)
            step_log.error(f"Blockchain log failed: {err_msg}")
            
            # Update status to failed_blockchain if this is the last retry
            if self.request.retries >= self.max_retries:
                tx_record.status = "failed_blockchain"
                _mark_log(db, agent_log, "failure", error=err_msg, started_at=started_at)
            
            raise self.retry(exc=exc)

# ── Task 5: reconcile_transactions_task ──────────────────────────────────────

@celery_app.task(
    bind=True,
    name="backend.tasks.tasks.reconcile_transactions_task",
)
def reconcile_transactions_task(self: Task, sme_address: str = None) -> dict:
    """
    Reconciliation Engine:
    Compares DB transactions with Blockchain records to find mismatches.
    """
    from backend.services.blockchain_service import blockchain_service
    from backend.db.models import SME, Transaction, ReconciliationLog
    import redis
    import time
    
    # Setup logging and timing
    start_time = time.monotonic()
    current_time_str = datetime.now().strftime("%H:%M:%S")
    print(f"[Reconciliation] Started at {current_time_str}")

    job_id = self.request.id or str(uuid.uuid4())
    step_log = AgentStepLogger("reconcile_tx", job_id, sme_address or "ALL")
    
    # Redis Lock to prevent duplicate execution
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    redis_client = redis.Redis.from_url(redis_url)
    lock_key = "lock:reconcile_transactions_task"
    
    # Try to acquire lock (expires slightly longer than our schedule to be safe)
    # If the interval is 5 mins, lock for 4 mins to ensure we don't overlap.
    lock_timeout = max(int(float(os.getenv("RECONCILIATION_INTERVAL_MINUTES", "5")) * 60) - 10, 60)
    acquired = redis_client.set(lock_key, "locked", nx=True, ex=lock_timeout)
    
    if not acquired:
        print(f"[Reconciliation] Skipped: Previous reconciliation is still running (lock active).")
        step_log.info("Skipped due to active Redis lock")
        return {"status": "skipped", "reason": "lock_active"}

    step_log.info("Starting reconciliation")

    results = {
        "missing_on_chain": 0,
        "missing_in_db": 0,
        "status_mismatch": 0,
        "data_mismatch": 0,
        "auto_repaired": 0
    }

    try:
        with get_db() as db:
            smes_to_check = []
            if sme_address:
                smes_to_check.append(sme_address.lower())
            else:
                smes = db.query(SME).all()
                smes_to_check = [sme.wallet_address.lower() for sme in smes]

            for addr in smes_to_check:
                # 1. Fetch DB transactions
                sme = db.query(SME).filter_by(wallet_address=addr).first()
                if not sme:
                    continue

                # Limit reconciliation to non-pending transactions older than 2 minutes
                from datetime import timedelta
                two_mins_ago = datetime.now(timezone.utc) - timedelta(minutes=2)
                db_txs = db.query(Transaction).filter(
                    Transaction.sme_id == sme.id,
                    Transaction.created_at < two_mins_ago
                ).all()

                db_tx_map = {tx.tx_hash: tx for tx in db_txs if tx.tx_hash}
                db_tx_no_hash = [tx for tx in db_txs if not tx.tx_hash]

                # 2. Fetch Blockchain records
                try:
                    bc_records = blockchain_service.get_activities(addr)
                except Exception as e:
                    step_log.error(f"Failed to fetch blockchain data for {addr}: {str(e)}")
                    continue

                bc_map = {r["tx_hash"]: r for r in bc_records if "tx_hash" in r}

                # 3. Check A: Missing on Blockchain (Status confirmed but no hash/record)
                for tx in db_txs:
                    if tx.status == "confirmed" and tx.tx_hash not in bc_map:
                        # Mark inconsistency
                        existing_log = db.query(ReconciliationLog).filter_by(transaction_id=tx.id, issue_type="missing_on_chain").first()
                        if not existing_log:
                            db.add(ReconciliationLog(
                                transaction_id=tx.id,
                                sme_address=addr,
                                issue_type="missing_on_chain",
                                details={"db_status": tx.status, "tx_hash": tx.tx_hash}
                            ))
                            results["missing_on_chain"] += 1

                            # Auto-repair: Enqueue blockchain log
                            blockchain_log_task.apply_async(kwargs={
                                "transaction_id": str(tx.id),
                                "sme_address": addr,
                                "activity_type": tx.activity_type,
                                "amount": tx.amount,
                                "description": tx.description,
                                "category": tx.category,
                            }, queue="blockchain_queue")
                            results["auto_repaired"] += 1

                    # Check C: Status Mismatch (DB says failed_blockchain but it exists on chain)
                    elif tx.status == "failed_blockchain" and tx.tx_hash in bc_map:
                        existing_log = db.query(ReconciliationLog).filter_by(transaction_id=tx.id, issue_type="status_mismatch").first()
                        if not existing_log:
                            db.add(ReconciliationLog(
                                transaction_id=tx.id,
                                sme_address=addr,
                                issue_type="status_mismatch",
                                details={"db_status": tx.status, "chain_exists": True}
                            ))
                            results["status_mismatch"] += 1
                            
                            # Auto-repair: Update status to confirmed
                            tx.status = "confirmed"
                            tx.blockchain_confirmed = True
                            results["auto_repaired"] += 1

                    # Check D: Data Mismatch
                    elif tx.status == "confirmed" and tx.tx_hash in bc_map:
                        bc_rec = bc_map[tx.tx_hash]
                        if tx.amount != bc_rec.get("amount") or tx.activity_type != bc_rec.get("activityType"):
                            existing_log = db.query(ReconciliationLog).filter_by(transaction_id=tx.id, issue_type="data_mismatch").first()
                            if not existing_log:
                                db.add(ReconciliationLog(
                                    transaction_id=tx.id,
                                    sme_address=addr,
                                    issue_type="data_mismatch",
                                    details={
                                        "db_amount": tx.amount, "chain_amount": bc_rec.get("amount"),
                                        "db_type": tx.activity_type, "chain_type": bc_rec.get("activityType")
                                    }
                                ))
                                results["data_mismatch"] += 1

                # Check B: Missing in DB
                for bc_hash, bc_rec in bc_map.items():
                    if bc_hash not in db_tx_map:
                        existing_log = db.query(ReconciliationLog).filter_by(sme_address=addr, issue_type="missing_in_db", details={"tx_hash": bc_hash}).first()
                        if not existing_log:
                            db.add(ReconciliationLog(
                                sme_address=addr,
                                issue_type="missing_in_db",
                                details={"tx_hash": bc_hash, "amount": bc_rec.get("amount"), "activity": bc_rec.get("activityType")}
                            ))
                            results["missing_in_db"] += 1

            db.commit()

        step_log.step("reconciliation_complete", "done", results=results)
        
        total_issues = results['missing_on_chain'] + results['missing_in_db'] + results['status_mismatch'] + results['data_mismatch']
        print(f"[Reconciliation] Found {total_issues} inconsistencies")
        
        return results

    finally:
        # Release the lock
        redis_client.delete(lock_key)
        
        # Log completion time
        elapsed_time = time.monotonic() - start_time
        print(f"[Reconciliation] Completed in {elapsed_time:.1f}s")
