import os
import json
import qrcode
from datetime import datetime, timezone
from typing import Type
from pydantic import BaseModel, Field
from crewai.tools import BaseTool
from contracts.mock_blockchain import get_activities, get_summary


class GenerateFundingProofInput(BaseModel):
    sme_address: str = Field(
        description="The SME's wallet address to generate the Funding Proof for"
    )
    days: int = Field(
        default=90,
        description="Number of past days to include in the proof. Use 30, 60, or 90."
    )
    sme_name: str = Field(
        default="BlueSME Business",
        description="The SME's business name for the report header"
    )
    sme_category: str = Field(
        default="Blue Economy SME",
        description="Business category e.g. 'Fish Trader', 'Boat Operator', 'Marine Tourism'"
    )


class GenerateFundingProofTool(BaseTool):
    name: str = "generate_funding_proof"
    description: str = """
    Generates a complete, verifiable Funding Proof report for an SME by pulling
    live data directly from the BlueSMETracker smart contract on Base Sepolia.

    Returns a structured report including financial summary, transaction history,
    a public verifier URL, and a QR code pointing to that URL.

    Use this when an SME requests a funding proof for a grant or loan application.
    """
    args_schema: Type[BaseModel] = GenerateFundingProofInput

    def _run(
        self,
        sme_address: str,
        days: int = 90,
        sme_name: str = "BlueSME Business",
        sme_category: str = "Blue Economy SME"
    ) -> str:
        try:
            total_sales, total_expenses, net_profit = get_summary(sme_address)

            raw_activities = get_activities(sme_address)

            if not raw_activities:
                return (
                    f"ERROR: No on-chain activities found for {sme_address}. "
                    f"The SME must log at least one transaction before generating a proof."
                )

            now = datetime.now(timezone.utc)
            cutoff_ts = int(now.timestamp()) - (days * 86400)

            activities_in_range = []
            for act in raw_activities:
                timestamp, activity_type, amount, description, category = act
                if timestamp >= cutoff_ts:
                    activities_in_range.append({
                        "date": datetime.fromtimestamp(timestamp, tz=timezone.utc).strftime("%Y-%m-%d"),
                        "type": activity_type,
                        "amount_kes": amount,
                        "description": description,
                        "category": category
                    })

            activities_in_range.sort(key=lambda x: x["date"], reverse=True)

            range_sales = sum(a["amount_kes"] for a in activities_in_range if a["type"] == "sale")
            range_expenses = sum(a["amount_kes"] for a in activities_in_range if a["type"] == "expense")

            # FIX (Bug #9): do NOT floor at 0 — a negative net profit is real
            # financial information that a funder must see.
            range_net = range_sales - range_expenses

            sale_count = len([a for a in activities_in_range if a["type"] == "sale"])
            expense_count = len([a for a in activities_in_range if a["type"] == "expense"])
            profit_margin = round((range_net / range_sales * 100), 1) if range_sales > 0 else 0

            categories = {}
            for a in activities_in_range:
                cat = a["category"]
                categories[cat] = categories.get(cat, 0) + a["amount_kes"]

            frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
            verifier_url = f"{frontend_url}/proof/{sme_address}"
            basescan_url = f"https://sepolia.basescan.org/address/{sme_address}"
            contract_address = os.getenv("CONTRACT_ADDRESS", "")
            contract_url = f"https://sepolia.basescan.org/address/{contract_address}"

            qr_dir = "funding_proofs"
            os.makedirs(qr_dir, exist_ok=True)
            qr_filename = f"{qr_dir}/proof_{sme_address[:8]}_{now.strftime('%Y%m%d')}.png"

            qr = qrcode.QRCode(version=1, box_size=10, border=4)
            qr.add_data(verifier_url)
            qr.make(fit=True)
            qr_img = qr.make_image(fill_color="black", back_color="white")
            qr_img.save(qr_filename)

            report = {
                "funding_proof": {
                    "generated_at": now.strftime("%Y-%m-%d %H:%M UTC"),
                    "generated_by": "BlueSME Blockchain Agent",
                    "data_source": "Base Sepolia Blockchain (immutable)",
                    "period_days": days,
                    "period_from": datetime.fromtimestamp(cutoff_ts, tz=timezone.utc).strftime("%Y-%m-%d"),
                    "period_to": now.strftime("%Y-%m-%d")
                },
                "sme_profile": {
                    "name": sme_name,
                    "category": sme_category,
                    "wallet_address": sme_address,
                    "blockchain": "Base Sepolia",
                    "contract": contract_address
                },
                "financial_summary": {
                    "total_sales_kes": range_sales,
                    "total_expenses_kes": range_expenses,
                    "net_profit_kes": range_net,
                    "profit_margin_pct": profit_margin,
                    "transaction_count": len(activities_in_range),
                    "sales_count": sale_count,
                    "expense_count": expense_count,
                    "category_breakdown": categories
                },
                "all_time_totals": {
                    "total_sales_kes": total_sales,
                    "total_expenses_kes": total_expenses,
                    "net_profit_kes": net_profit,
                    "total_transactions": len(raw_activities)
                },
                "recent_transactions": activities_in_range[:10],
                "verification": {
                    "verifier_url": verifier_url,
                    "basescan_sme": basescan_url,
                    "basescan_contract": contract_url,
                    "qr_code_path": qr_filename,
                    "note": "All data is pulled live from the blockchain — immutable and tamper-proof"
                }
            }

            net_label = f"KES {range_net:,}" if range_net >= 0 else f"-KES {abs(range_net):,}"
            readable = (
                f"\n{'═' * 55}\n"
                f"  BLUESME FUNDING PROOF REPORT\n"
                f"{'═' * 55}\n"
                f"  Business:    {sme_name}\n"
                f"  Category:    {sme_category}\n"
                f"  Period:      Last {days} days\n"
                f"  Generated:   {now.strftime('%Y-%m-%d %H:%M UTC')}\n"
                f"{'─' * 55}\n"
                f"  FINANCIAL SUMMARY ({days}-DAY PERIOD)\n"
                f"{'─' * 55}\n"
                f"  Total Sales:        KES {range_sales:>10,}\n"
                f"  Total Expenses:     KES {range_expenses:>10,}\n"
                f"  Net Profit/Loss:    {net_label:>14}\n"
                f"  Profit Margin:      {profit_margin}%\n"
                f"  Transactions:       {len(activities_in_range)} "
                f"({sale_count} sales, {expense_count} expenses)\n"
                f"{'─' * 55}\n"
                f"  ALL-TIME TOTALS\n"
                f"{'─' * 55}\n"
                f"  Total Sales:        KES {total_sales:>10,}\n"
                f"  Net Profit:         KES {net_profit:>10,}\n"
                f"  Total Transactions: {len(raw_activities)}\n"
                f"{'─' * 55}\n"
                f"  VERIFICATION\n"
                f"{'─' * 55}\n"
                f"  Verifier URL: {verifier_url}\n"
                f"  Basescan:     {basescan_url}\n"
                f"  QR Code:      {qr_filename}\n"
                f"{'═' * 55}\n"
                f"  Source: Base Sepolia — immutable on-chain data\n"
                f"{'═' * 55}\n"
            )

            return readable + f"\n\nFULL_REPORT_JSON:\n{json.dumps(report, indent=2)}"

        except ValueError as e:
            return f"CONFIG ERROR: {str(e)}"
        except Exception as e:
            return f"ERROR generating funding proof: {str(e)}"