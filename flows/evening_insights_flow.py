import json
import os
from pydantic import BaseModel
from crewai import Crew
from crewai.flow.flow import Flow, listen, start

from agents.insights_agent import insights_agent
from agents.blockchain_agent import blockchain_agent
from agents.tasks import (
    make_evening_insights_task,
    make_log_activity_task,
)
from test_mode import is_test_mode, mock_insights_output, mock_blockchain_output


class EveningInsightsState(BaseModel):
    sme_address: str = ""
    is_week_end: bool = False   # True only on Sunday evenings


class EveningInsightsFlow(Flow[EveningInsightsState]):

    @start()
    def run_insights_analysis(self):
        """Triggered at 8 PM EAT daily by the orchestrator's scheduler."""
        if is_test_mode():
            return mock_insights_output(self.state.sme_address)

        task = make_evening_insights_task(sme_address=self.state.sme_address)
        crew = Crew(agents=[insights_agent], tasks=[task], verbose=True)
        result = crew.kickoff()
        return result.raw   # ← .raw gives the plain string, not a CrewOutput object

    @listen(run_insights_analysis)
    def log_weekly_summary(self, insights_raw: str):
        """
        Runs every evening but only writes to the chain on Sunday.
        FIX (Bug #7): added explicit return for non-Sunday paths.
        FIX (Bug #4): parse the agent's JSON output before accessing fields.
        """
        if not self.state.is_week_end:
            # Nothing to log on weekdays — return a status string, not None
            return "Weekday insights complete. No on-chain write today."

        if is_test_mode():
            return mock_blockchain_output(insights_raw, label="weekly summary")

        # Parse the insights agent's JSON output
        try:
            data = json.loads(insights_raw)
            net_profit = int(data.get("net_profit", 0))
            summary_text = data.get("summary_text", "Weekly summary")
            primary_category = data.get("primary_category", "fisheries")
        except (json.JSONDecodeError, KeyError, ValueError):
            # Agent returned plain text — fall back to safe defaults and log anyway
            net_profit = 0
            summary_text = insights_raw[:200]  # truncate to fit description field
            primary_category = "fisheries"

        weekly_payload = json.dumps({
            "event": "weekly_summary_ready",
            "activity_type": "weekly_summary",
            "amount": net_profit,
            "description": summary_text,
            "category": primary_category,
            "sme_address": self.state.sme_address,
        })

        task = make_log_activity_task(confirmed_payload_json=weekly_payload)
        crew = Crew(agents=[blockchain_agent], tasks=[task], verbose=True)
        result = crew.kickoff()
        return result.raw