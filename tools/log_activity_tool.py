import os
from typing import Type
from pydantic import BaseModel, Field
from crewai.tools import BaseTool
from contracts.mock_blockchain import log_activity_for


class LogActivityInput(BaseModel):
    sme_address: str = Field(
        description="The SME's wallet address (0x...) whose record this belongs to"
    )
    activity_type: str = Field(
        description="Type of activity: 'sale', 'expense', or 'weekly_summary'"
    )
    amount: int = Field(
        description="Amount in KES as a whole integer (e.g. 4500 for KES 4,500)"
    )
    description: str = Field(
        description="Human-readable description e.g. 'Sold 30kg kingfish at Kongowea market'"
    )
    category: str = Field(
        description="Business category: 'fisheries', 'marine_tourism', or 'boat_operations'"
    )


class LogActivityTool(BaseTool):
    name: str = "log_activity_on_chain"
    description: str = """
    Records a verified SME business activity permanently on the Base Sepolia blockchain
    via the BlueSMETracker smart contract.

    Call this ONLY after:
    - A sale has been confirmed by the Finance Agent, OR
    - An expense has been verified by the Finance Agent, OR
    - A weekly summary has been prepared by the Insights Agent.

    Never call this with unconfirmed or estimated data.
    Returns the transaction hash as proof of recording.
    """
    args_schema: Type[BaseModel] = LogActivityInput

    def _run(
        self,
        sme_address: str,
        activity_type: str,
        amount: int,
        description: str,
        category: str
    ) -> str:
        try:
            valid_types = ["sale", "expense", "weekly_summary"]
            if activity_type not in valid_types:
                return f"ERROR: activity_type must be one of {valid_types}. Got: '{activity_type}'"

            valid_categories = ["fisheries", "marine_tourism", "boat_operations"]
            if category not in valid_categories:
                return f"ERROR: category must be one of {valid_categories}. Got: '{category}'"

            # Mock logging
            tx_hash_hex = log_activity_for(
                sme_address,
                activity_type,
                amount,
                description,
                category
            )

            mock_scan_url = f"https://mock.basescan.org/tx/{tx_hash_hex}"
            return (
                f"SUCCESS: Activity logged on-chain for SME {sme_address}.\n"
                f"Type: {activity_type} | Amount: KES {amount:,}\n"
                f"Description: {description}\n"
                f"Transaction: {tx_hash_hex}\n"
                f"Verify: {mock_scan_url}"
            )

        except Exception as e:
            return f"ERROR logging activity: {str(e)}"