import json
from datetime import datetime, timezone
from typing import Type
from pydantic import BaseModel, Field
from crewai.tools import BaseTool
from contracts.mock_blockchain import get_activities


class GetActivitiesInput(BaseModel):
    sme_address: str = Field(
        description="The SME's wallet address to fetch activity history for"
    )
    days: int = Field(
        default=90,
        description="Number of past days to include (default 90). Use 30, 60, or 90."
    )


class GetActivitiesTool(BaseTool):
    name: str = "get_sme_activities"
    description: str = """
    Fetches the complete on-chain activity history for a given SME wallet address
    from the BlueSMETracker smart contract on Base Sepolia.
    
    Returns a list of all logged sales, expenses, and weekly summaries
    with timestamps, amounts in KES, descriptions, and categories.
    
    Use this when:
    - Building a Funding Proof report
    - Showing an SME their transaction history
    - The Insights Agent needs historical data for analysis
    """
    args_schema: Type[BaseModel] = GetActivitiesInput

    def _run(self, sme_address: str, days: int = 90) -> str:
        try:
            raw_activities = get_activities(sme_address)

            if not raw_activities:
                return f"No on-chain activities found for {sme_address}. The SME has not logged any transactions yet."

            # Filter by days
            now = datetime.now(timezone.utc)
            cutoff_ts = int(now.timestamp()) - (days * 86400)

            activities = []
            for act in raw_activities:
                timestamp, activity_type, amount, description, category = act
                if timestamp >= cutoff_ts:
                    dt = datetime.fromtimestamp(timestamp, tz=timezone.utc)
                    activities.append({
                        "date": dt.strftime("%Y-%m-%d %H:%M UTC"),
                        "type": activity_type,
                        "amount_kes": amount,
                        "description": description,
                        "category": category,
                        "timestamp": timestamp
                    })

            # Sort newest first
            activities.sort(key=lambda x: x["timestamp"], reverse=True)

            # Build readable summary
            sales = [a for a in activities if a["type"] == "sale"]
            expenses = [a for a in activities if a["type"] == "expense"]
            summaries = [a for a in activities if a["type"] == "weekly_summary"]

            result = (
                f"ON-CHAIN ACTIVITY HISTORY — Last {days} days\n"
                f"SME Address: {sme_address}\n"
                f"{'─' * 50}\n"
                f"Total records: {len(activities)} "
                f"({len(sales)} sales | {len(expenses)} expenses | {len(summaries)} summaries)\n\n"
            )

            for a in activities:
                result += (
                    f"[{a['date']}] {a['type'].upper()}\n"
                    f"  Amount: KES {a['amount_kes']:,}\n"
                    f"  {a['description']}\n"
                    f"  Category: {a['category']}\n\n"
                )

            return result

        except ValueError as e:
            return f"CONFIG ERROR: {str(e)}"
        except Exception as e:
            return f"ERROR fetching activities: {str(e)}"