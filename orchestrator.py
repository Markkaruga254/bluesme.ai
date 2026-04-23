import asyncio
from datetime import datetime, timezone, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from flows.sale_logging_flow import SaleLoggingFlow, SaleLoggingState
from flows.evening_insights_flow import EveningInsightsFlow, EveningInsightsState
from flows.funding_proof_flow import FundingProofFlow, FundingProofState


# ── SME addresses to run nightly insights for ─────────────────
# In production, load these from a database or config file.
ACTIVE_SME_ADDRESSES: list[str] = []


class BlueSMEOrchestrator:

    def route(self, event: dict):
        """
        Synchronous entry point — routes an incoming event to the correct flow.
        Each flow is initialised with its typed state, not via kickoff(inputs={}).
        """
        match event["type"]:

            case "user_sale_input":
                state = SaleLoggingState(
                    user_input=event["message"],
                    sme_address=event["sme_address"],
                )
                flow = SaleLoggingFlow()
                flow.state = state
                flow.kickoff()

            case "daily_schedule":
                # Fired by the scheduler below — not called directly in production
                state = EveningInsightsState(
                    sme_address=event["sme_address"],
                    is_week_end=event.get("is_week_end", False),
                )
                flow = EveningInsightsFlow()
                flow.state = state
                flow.kickoff()

            case "funding_proof_request":
                state = FundingProofState(
                    sme_address=event["sme_address"],
                    sme_name=event.get("sme_name", "BlueSME Business"),
                    sme_category=event.get("sme_category", "Blue Economy SME"),
                    days=event.get("days", 90),
                )
                flow = FundingProofFlow()
                flow.state = state
                flow.kickoff()

            case _:
                print(f"[Orchestrator] Unknown event type: {event['type']}")


# ── Scheduler: fires EveningInsightsFlow at 8 PM EAT daily ────

def _is_sunday_in_eat() -> bool:
    eat = timezone(timedelta(hours=3))
    return datetime.now(eat).weekday() == 6  # 6 = Sunday


def _run_nightly_insights():
    """Called by APScheduler at 8 PM EAT every day."""
    orchestrator = BlueSMEOrchestrator()
    is_sunday = _is_sunday_in_eat()

    for sme_address in ACTIVE_SME_ADDRESSES:
        print(f"[Scheduler] Running evening insights for {sme_address}")
        orchestrator.route({
            "type": "daily_schedule",
            "sme_address": sme_address,
            "is_week_end": is_sunday,
        })


def start_scheduler():
    """
    Starts the APScheduler loop. Call this from your main entry point.
    The scheduler fires the nightly insights job at 17:00 UTC = 20:00 EAT.
    """
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        _run_nightly_insights,
        trigger="cron",
        hour=17,       # 17:00 UTC = 20:00 EAT
        minute=0,
        id="nightly_insights",
        replace_existing=True,
    )
    scheduler.start()
    print("[Orchestrator] Scheduler started — nightly insights at 20:00 EAT")
    return scheduler


# ── Entry point ───────────────────────────────────────────────

if __name__ == "__main__":
    async def main():
        scheduler = start_scheduler()
        try:
            # Keep the event loop alive so the scheduler can fire
            while True:
                await asyncio.sleep(60)
        except (KeyboardInterrupt, SystemExit):
            scheduler.shutdown()

    asyncio.run(main())