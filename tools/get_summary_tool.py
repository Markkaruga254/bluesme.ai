from typing import Type
from pydantic import BaseModel, Field
from crewai.tools import BaseTool
from contracts.mock_blockchain import get_summary


class GetSummaryInput(BaseModel):
    sme_address: str = Field(
        description="The SME's wallet address to fetch financial summary for"
    )


class GetSummaryTool(BaseTool):
    name: str = "get_sme_summary"
    description: str = """
    Fetches the on-chain financial summary for a given SME — total sales,
    total expenses, and net profit — directly from the BlueSMETracker 
    smart contract on Base Sepolia.
    
    This is a fast, live read from the blockchain.
    All amounts are in KES.
    
    Use this when:
    - Generating the header of a Funding Proof report
    - Showing an SME their overall performance at a glance
    - Quick health check before a funding application
    """
    args_schema: Type[BaseModel] = GetSummaryInput

    def _run(self, sme_address: str) -> str:
        try:
            total_sales, total_expenses, net_profit = get_summary(sme_address)

            if total_sales == 0 and total_expenses == 0:
                return f"No financial data found on-chain for {sme_address}."

            profit_margin = (
                round((net_profit / total_sales) * 100, 1) if total_sales > 0 else 0
            )

            return (
                f"ON-CHAIN FINANCIAL SUMMARY\n"
                f"SME Address: {sme_address}\n"
                f"{'─' * 40}\n"
                f"Total Sales:     KES {total_sales:>10,}\n"
                f"Total Expenses:  KES {total_expenses:>10,}\n"
                f"Net Profit:      KES {net_profit:>10,}\n"
                f"Profit Margin:   {profit_margin}%\n"
                f"{'─' * 40}\n"
                f"Source: BlueSMETracker on Base Sepolia (immutable)"
            )

        except ValueError as e:
            return f"CONFIG ERROR: {str(e)}"
        except Exception as e:
            return f"ERROR fetching summary: {str(e)}"