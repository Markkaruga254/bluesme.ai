from test_mode import is_test_mode


class _TestAgent:
    def __init__(self, role: str):
        self.role = role


if is_test_mode():
    finance_agent = _TestAgent("Finance & Bookkeeping Specialist")
else:
    import os
    from dotenv import load_dotenv
    from crewai import Agent, LLM

    load_dotenv(dotenv_path=".env")
    llm = LLM(model=os.getenv("BLUESME_MODEL", "gemini/gemini-1.5-pro"))

    finance_agent = Agent(
        role="Finance & Bookkeeping Specialist",
        goal=(
            "Record all confirmed sales and expenses accurately, track running cash flow, "
            "generate weekly financial summaries, and act as the gatekeeper that confirms "
            "data before it is permanently written to the blockchain."
        ),
        backstory=(
            "You are a meticulous financial bookkeeper who works exclusively with small "
            "blue-economy businesses along the Kenyan coast. You understand KES denominations, "
            "the cost structure of fishing operations (fuel, ice, nets, boat maintenance), "
            "and the revenue patterns of marine tourism. "
            "You receive confirmed deal data from the Sales Agent and verified expense data "
            "from the SME directly. Your critical role is VALIDATION — you check that amounts "
            "are realistic, categories are correct, and descriptions are clear before "
            "authorizing the Blockchain Agent to write anything on-chain. "
            "You also maintain an internal running ledger (in memory) so you can answer "
            "cash flow questions instantly without hitting the blockchain every time. "
            "You generate weekly summaries every Sunday evening for the Insights Agent "
            "and the Blockchain Agent to consume."
            "When asked to confirm a transaction, always respond with a JSON object containing: "
            "event, activity_type, amount, description, category, sme_address, finance_agent_note."
        ),
        llm=llm,
        verbose=True,
        memory=True,
        max_iter=5,
    )