import os
import re
import json


def is_test_mode() -> bool:
    return os.getenv("BLUESME_TEST_MODE", "0") == "1"


def _parse_kes_amount(text: str) -> int:
    """Extract amount from text, handling 'k' notation and separators."""
    # Handle '5k', '10.5k' etc. Ensure 'k' is NOT followed by 'es' or 'sh' (like KES or KSh)
    # Negative lookahead for 'es' or 'sh'
    k_match = re.search(r"(\d+(?:\.\d+)?)\s*k(?!(?:es|sh))(?:\s|$)", text.lower())
    if k_match:
        return int(float(k_match.group(1)) * 1000)

    # Standard number extraction (prefer numbers near 'kes' or 'for')
    # This regex finds numbers like 10,000 or 10000
    amounts = re.findall(r"(\d+(?:,\d{3})*)", text)
    if not amounts:
        return 0
    
    # Heuristic: pick the largest number as amount
    clean_amounts = [int(a.replace(",", "")) for a in amounts]
    return max(clean_amounts)


def mock_sale_output(user_input: str, sme_address: str) -> str:
    """Smart mock that extracts data from input using regex."""
    text = user_input.lower()
    
    # Extract amount
    amount = _parse_kes_amount(text)
    if amount == 0:
        raise ValueError("Could not determine a valid sale amount from the input.")

    # Extract quantity (e.g. 50kg, 10 litres)
    qty = 0
    qty_match = re.search(r"(\d+)\s*(kg|kilogram|liter|litre|trip|bag|box)", text)
    if qty_match:
        qty = int(qty_match.group(1))

    # Extract product/category
    category = "other"
    if any(word in text for word in ["fish", "samaki", "prawn", "crab"]):
        category = "fisheries"
    elif any(word in text for word in ["tour", "dhow", "guest", "trip"]):
        category = "marine_tourism"
    elif any(word in text for word in ["boat", "repair", "fuel", "engine"]):
        category = "boat_operations"

    description = f"Smart Mock: {user_input[:50]}"
    if qty > 0:
        description = f"Smart Mock: Sold {qty} units of goods"

    output = {
        "event": "deal_confirmed",
        "activity_type": "sale",
        "amount": amount,
        "description": description,
        "category": category,
        "sme_address": sme_address
    }
    return json.dumps(output)


def mock_finance_output(sales_output: str) -> str:
    try:
        data = json.loads(sales_output)
        data["event"] = "finance_confirmed"
        data["finance_agent_note"] = "Smart Mock: Auto-validated based on realistic ranges."
        return json.dumps(data)
    except:
        return sales_output


def mock_insights_output(sme_address: str) -> str:
    return json.dumps({
        "net_profit": 12000,
        "summary_text": "Smart Mock: Your business is performing within expected seasonal bounds.",
        "primary_category": "fisheries",
        "insights": [
            "Smart Mock: Demand for Kingfish is expected to rise next week.",
            "Smart Mock: Fuel efficiency has improved by 5%."
        ]
    })


def mock_blockchain_output(payload: str, label: str = "activity") -> str:
    return f"[SMART TEST MODE] Simulated on-chain record for {label}. Payload: {payload}"


def mock_proof_output(sme_address: str, days: int, sme_name: str, sme_category: str) -> str:
    return (
        "[SMART TEST MODE] Funding proof generated\n"
        f"SME: {sme_name} ({sme_address})\n"
        f"Category: {sme_category}\n"
        f"Period: {days} days\n"
        "Status: VERIFIED ON MOCK CHAIN"
    )
