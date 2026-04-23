import json
import os
import sys
import traceback


def _safe_output(output):
    if output is None:
        return ""
    if isinstance(output, str):
        return output
    raw = getattr(output, "raw", None)
    if isinstance(raw, str):
        return raw
    return str(output)


def _run(flow_name: str, payload: dict):
    # Add project root to sys.path so imports work
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    
    if flow_name == "log_sale":
        from flows.sale_logging_flow import SaleLoggingFlow

        flow = SaleLoggingFlow()
        return flow.kickoff(
            inputs={
                "user_input": payload.get("saleMessage", ""),
                "sme_address": payload.get("smeAddress", ""),
            }
        )

    if flow_name == "run_insights":
        from flows.evening_insights_flow import EveningInsightsFlow

        flow = EveningInsightsFlow()
        return flow.kickoff(
            inputs={
                "sme_address": payload.get("smeAddress", ""),
                "is_week_end": bool(payload.get("isWeekEnd", False)),
            }
        )

    if flow_name == "generate_proof":
        from flows.funding_proof_flow import FundingProofFlow

        flow = FundingProofFlow()
        return flow.kickoff(
            inputs={
                "sme_address": payload.get("smeAddress", ""),
                "sme_name": payload.get("smeName", "BlueSME Business"),
                "sme_category": payload.get("smeCategory", "Blue Economy SME"),
                "days": int(payload.get("days", 90)),
            }
        )

    raise ValueError(f"Unknown flow: {flow_name}")


def main():
    if len(sys.argv) < 3:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Usage: run_flow.py <flow_name> <payload_json>",
                }
            )
        )
        sys.exit(1)

    flow_name = sys.argv[1]
    payload_json = sys.argv[2]

    try:
        payload = json.loads(payload_json)
        result = _run(flow_name, payload)
        print(
            json.dumps(
                {
                    "ok": True,
                    "output": _safe_output(result),
                    "testMode": os.getenv("BLUESME_TEST_MODE", "0") == "1",
                }
            )
        )
    except Exception as exc:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                }
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()