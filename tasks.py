"""
tasks.py — All CrewAI Task definitions for BlueSME.

FIX (Bug #1 + #2): Agent objects have no .kickoff() method.
Only Crew objects do. Tasks define what an agent must do,
and a Crew bundles agent + task(s) for execution.

Usage in flows:
    from agents.tasks import make_parse_sale_task
    from crewai import Crew

    task = make_parse_sale_task(user_message, sme_address)
    crew = Crew(agents=[sales_agent], tasks=[task])
    result = crew.kickoff()
    output_text = result.raw   # ← always use .raw to get the string
"""

from crewai import Task
from agents.sales_agent import sales_agent
from agents.finance_agent import finance_agent
from agents.insights_agent import insights_agent
from agents.blockchain_agent import blockchain_agent


# ── Agent 1: Sales ────────────────────────────────────────────

def make_parse_sale_task(user_message: str, sme_address: str) -> Task:
    """Sales agent parses a raw SME message into a structured sale payload."""
    return Task(
        description=(
            f"An SME owner sent this message: '{user_message}'\n"
            f"Their wallet address is: {sme_address}\n\n"
            "Parse the message and extract the sale details. "
            "If anything is ambiguous (amount, category), ask for clarification "
            "before producing the output. Never guess.\n\n"
            "Respond with ONLY a JSON object — no preamble, no markdown fences:\n"
            "{\n"
            '  "event": "deal_confirmed",\n'
            '  "activity_type": "sale",\n'
            '  "amount": <integer KES>,\n'
            '  "description": "<human-readable description>",\n'
            '  "category": "<fisheries|marine_tourism|boat_operations>",\n'
            '  "sme_address": "<wallet address>"\n'
            "}"
        ),
        expected_output=(
            "A valid JSON object with keys: event, activity_type, amount, "
            "description, category, sme_address. No extra text."
        ),
        agent=sales_agent,
    )


# ── Agent 2: Finance ──────────────────────────────────────────

def make_finance_confirmation_task(sale_json: str) -> Task:
    """Finance agent validates the sale payload before it goes on-chain."""
    return Task(
        description=(
            f"The Sales Agent produced this sale payload:\n{sale_json}\n\n"
            "Validate the following:\n"
            "1. Is the amount realistic for this category in Mombasa? "
            "(e.g. KES 500,000 for a single fish sale would be suspicious)\n"
            "2. Is the category one of: fisheries, marine_tourism, boat_operations?\n"
            "3. Is the description clear and specific?\n\n"
            "If valid, respond with ONLY a JSON object — no preamble, no markdown:\n"
            "{\n"
            '  "event": "finance_confirmed",\n'
            '  "activity_type": "<same as input>",\n'
            '  "amount": <integer KES>,\n'
            '  "description": "<description>",\n'
            '  "category": "<category>",\n'
            '  "sme_address": "<address>",\n'
            '  "finance_agent_note": "<your validation note>"\n'
            "}\n\n"
            "If invalid, respond with a JSON object with event: 'finance_rejected' "
            "and a reason field explaining what is wrong."
        ),
        expected_output=(
            "A valid JSON object with event 'finance_confirmed' or 'finance_rejected'. "
            "No extra text outside the JSON."
        ),
        agent=finance_agent,
    )


def make_weekly_summary_task(sme_address: str) -> Task:
    """Finance agent compiles the week's ledger into a weekly summary payload."""
    return Task(
        description=(
            f"Compile a weekly financial summary for SME wallet: {sme_address}\n\n"
            "Using your memory of this week's confirmed transactions, produce "
            "a JSON summary for the Blockchain Agent to log on-chain.\n\n"
            "Respond with ONLY a JSON object — no preamble, no markdown:\n"
            "{\n"
            '  "event": "weekly_summary_ready",\n'
            '  "activity_type": "weekly_summary",\n'
            '  "amount": <net profit for the week as integer KES>,\n'
            '  "description": "<e.g. Week 28: 12 sales, 4 expenses, net KES 47,800>",\n'
            '  "category": "<primary category for the week>",\n'
            f'  "sme_address": "{sme_address}"\n'
            "}"
        ),
        expected_output=(
            "A valid JSON weekly summary object. No extra text outside the JSON."
        ),
        agent=finance_agent,
    )


# ── Agent 3: Insights ─────────────────────────────────────────

def make_evening_insights_task(sme_address: str) -> Task:
    """Insights agent runs evening analysis on today's data."""
    return Task(
        description=(
            f"Run the evening business intelligence analysis for SME: {sme_address}\n\n"
            "Analyze today's sales and expense data from your memory. "
            "Surface the most important trend, opportunity, or risk alert.\n\n"
            "Keep recommendations under 3 bullet points, in plain language "
            "suitable for a mobile screen. Use Swahili if the SME prefers it.\n\n"
            "Respond with ONLY a JSON object:\n"
            "{\n"
            '  "net_profit": <integer KES for today>,\n'
            '  "summary_text": "<one-line summary>",\n'
            '  "primary_category": "<main category today>",\n'
            '  "insights": ["<insight 1>", "<insight 2>", "<insight 3>"]\n'
            "}"
        ),
        expected_output=(
            "A valid JSON object with keys: net_profit, summary_text, "
            "primary_category, insights. No extra text."
        ),
        agent=insights_agent,
    )


# ── Agent 4: Blockchain ───────────────────────────────────────

def make_log_activity_task(confirmed_payload_json: str) -> Task:
    """Blockchain agent writes a finance-confirmed payload to the chain."""
    return Task(
        description=(
            f"The Finance Agent has confirmed this activity:\n{confirmed_payload_json}\n\n"
            "Use the log_activity_on_chain tool to permanently record this on "
            "Base Sepolia. Pass all fields exactly as provided.\n\n"
            "After logging, return a confirmation message with the transaction hash "
            "and the Basescan URL. Format the message so it is readable on a mobile "
            "screen. Include a Swahili confirmation line: 'Imerekodiwa ✓'"
        ),
        expected_output=(
            "A confirmation message containing the transaction hash, "
            "Basescan URL, and a brief summary of what was logged."
        ),
        agent=blockchain_agent,
    )


def make_generate_proof_task(sme_address: str, days: int = 90,
                              sme_name: str = "BlueSME Business",
                              sme_category: str = "Blue Economy SME") -> Task:
    """Blockchain agent generates a full Funding Proof report."""
    return Task(
        description=(
            f"Generate a complete Funding Proof report for:\n"
            f"  SME address:  {sme_address}\n"
            f"  Business name: {sme_name}\n"
            f"  Category:      {sme_category}\n"
            f"  Period:        Last {days} days\n\n"
            "Use the generate_funding_proof tool with the above parameters. "
            "Return the full report output including the verification URL and "
            "the path to the saved QR code."
        ),
        expected_output=(
            "The complete Funding Proof report text including financial summary, "
            "verification links, QR code path, and the FULL_REPORT_JSON block."
        ),
        agent=blockchain_agent,
    )