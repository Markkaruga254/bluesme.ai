import json
import os
from pydantic import BaseModel
from crewai import Crew
from crewai.flow.flow import Flow, listen, start

from agents.sales_agent import sales_agent
from agents.finance_agent import finance_agent
from agents.blockchain_agent import blockchain_agent
from agents.tasks import (
    make_parse_sale_task,
    make_finance_confirmation_task,
    make_log_activity_task,
)
from test_mode import is_test_mode, mock_sale_output, mock_finance_output, mock_blockchain_output


class SaleLoggingState(BaseModel):
    user_input: str = ""
    sme_address: str = ""
    # Internal — passed between steps
    sales_output: str = ""
    finance_output: str = ""


class SaleLoggingFlow(Flow[SaleLoggingState]):

    @start()
    def receive_user_input(self):
        """Sales agent parses the SME's raw message into a structured payload."""
        if is_test_mode():
            result = mock_sale_output(self.state.user_input, self.state.sme_address)
            self.state.sales_output = result
            return result

        task = make_parse_sale_task(
            user_message=self.state.user_input,
            sme_address=self.state.sme_address,
        )
        crew = Crew(agents=[sales_agent], tasks=[task], verbose=True)
        result = crew.kickoff()
        self.state.sales_output = result.raw
        return result.raw

    @listen(receive_user_input)
    def finance_confirmation(self, sales_output: str):
        """Finance agent validates the sale before it goes on-chain."""
        if is_test_mode():
            result = mock_finance_output(sales_output)
            self.state.finance_output = result
            return result

        task = make_finance_confirmation_task(sale_json=sales_output)
        crew = Crew(agents=[finance_agent], tasks=[task], verbose=True)
        result = crew.kickoff()
        self.state.finance_output = result.raw
        return result.raw

    @listen(finance_confirmation)
    def blockchain_log(self, confirmed_payload: str):
        """Blockchain agent writes the confirmed payload to Base Sepolia."""
        if is_test_mode():
            return mock_blockchain_output(confirmed_payload, label="sale activity")

        # Guard: don't log if the finance agent rejected the transaction
        try:
            data = json.loads(confirmed_payload)
            if data.get("event") == "finance_rejected":
                reason = data.get("reason", "Unknown reason")
                return f"Transaction NOT logged. Finance agent rejected: {reason}"
        except json.JSONDecodeError:
            pass  # agent returned plain text — proceed

        task = make_log_activity_task(confirmed_payload_json=confirmed_payload)
        crew = Crew(agents=[blockchain_agent], tasks=[task], verbose=True)
        result = crew.kickoff()
        return result.raw