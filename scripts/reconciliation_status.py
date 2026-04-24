import os
import sys
import json
from datetime import datetime

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

from backend.db.session import get_db
from backend.db.models import ReconciliationLog

def get_reconciliation_status():
    with get_db() as db:
        logs = db.query(ReconciliationLog).order_by(ReconciliationLog.detected_at.desc()).limit(50).all()
        
        breakdown = {
            "missing_on_chain": 0,
            "missing_in_db": 0,
            "status_mismatch": 0,
            "data_mismatch": 0,
        }
        total_unresolved = 0
        total_resolved = 0

        # For the breakdown, we might want to query counts directly
        for type_key in breakdown.keys():
            count = db.query(ReconciliationLog).filter_by(issue_type=type_key, resolved=False).count()
            breakdown[type_key] = count
            total_unresolved += count

        total_resolved = db.query(ReconciliationLog).filter_by(resolved=True).count()

        recent_logs = []
        for log in logs:
            recent_logs.append({
                "id": str(log.id),
                "transaction_id": str(log.transaction_id) if log.transaction_id else None,
                "sme_address": log.sme_address,
                "issue_type": log.issue_type,
                "details": log.details,
                "resolved": log.resolved,
                "resolution_notes": log.resolution_notes,
                "detected_at": log.detected_at.isoformat()
            })

        return {
            "total_unresolved": total_unresolved,
            "total_resolved": total_resolved,
            "breakdown": breakdown,
            "recent_logs": recent_logs
        }

if __name__ == "__main__":
    try:
        status = get_reconciliation_status()
        print(json.dumps({"ok": True, "data": status}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": str(e)}))
