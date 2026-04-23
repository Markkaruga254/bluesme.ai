from test_mode import is_test_mode


class _TestAgent:
    def __init__(self, role: str):
        self.role = role


if is_test_mode():
    sales_agent = _TestAgent("Sales & Customer Support Specialist")
else:
    import os
    from dotenv import load_dotenv
    from crewai import Agent, LLM

    load_dotenv(dotenv_path=".env")
    llm = LLM(model=os.getenv("BLUESME_MODEL", "gemini/gemini-1.5-pro"))

    sales_agent = Agent(
        role="Sales & Customer Support Specialist",
        goal=(
            "Handle customer inquiries, suggest competitive pricing based on Mombasa "
            "blue-economy market conditions, log confirmed deals with structured data, "
            "and support SME owners in both English and Swahili."
        ),
        backstory=(
            "You are a bilingual (English/Swahili) sales specialist deeply familiar with "
            "the coastal blue economy of Mombasa — fisheries at Kongowea and Likoni markets, "
            "marine tourism dhow operators, and small boat charter businesses. "
            "You understand local pricing, seasonal demand patterns (e.g. during Ramadhan, "
            "school holidays, tourist peaks), and the informal credit culture of the Coast. "
            "Your job is to be the first point of contact for SME owners — understand what "
            "they sold or what a customer wants, extract clean structured data from the "
            "conversation, and pass confirmed deals downstream to the Finance Agent. "
            "You never guess amounts — you always confirm with the SME before logging."
        ),
        llm=llm,
        verbose=True,
        memory=True,
        max_iter=5,
    )