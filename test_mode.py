import os


def is_test_mode() -> bool:
    return os.getenv("BLUESME_TEST_MODE", "0") == "1"


def mock_sale_output(user_input: str, sme_address: str) -> str:
    return (
        '{"event":"deal_confirmed","activity_type":"sale",'
        '"amount":4500,"description":"Mock sale parsed",'
        '"category":"fisheries","sme_address":"' + sme_address + '"}'
    )


def mock_finance_output(sales_output: str) -> str:
    return sales_output


def mock_insights_output(sme_address: str) -> str:
    return (
        '{"net_profit":12000,"summary_text":"Mock daily insight",'
        '"primary_category":"fisheries","insights":["Demand up","Costs stable"]}'
    )


def mock_blockchain_output(payload: str, label: str = "activity") -> str:
    return f"[TEST MODE] Skipped on-chain write for {label}. Payload: {payload}"


def mock_proof_output(sme_address: str, days: int, sme_name: str, sme_category: str) -> str:
    return (
        "[TEST MODE] Funding proof generated\\n"
        f"SME: {sme_name} ({sme_address})\\n"
        f"Category: {sme_category}\\n"
        f"Days: {days}"
    )
