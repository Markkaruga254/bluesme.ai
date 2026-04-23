from pydantic import BaseModel
from crewai import Crew
from crewai.flow.flow import Flow, start

from agents.blockchain_agent import blockchain_agent
from agents.tasks import make_generate_proof_task
from test_mode import is_test_mode, mock_proof_output


class FundingProofState(BaseModel):
    sme_address: str = ""
    sme_name: str = "BlueSME Business"
    sme_category: str = "Blue Economy SME"
    days: int = 90


class FundingProofFlow(Flow[FundingProofState]):

    @start()
    def generate_proof(self):
        """
        Blockchain agent calls GenerateFundingProofTool — which pulls live
        on-chain data AND builds the full report in one tool invocation.
        No second step needed.
        """
        if is_test_mode():
            return mock_proof_output(
                sme_address=self.state.sme_address,
                days=self.state.days,
                sme_name=self.state.sme_name,
                sme_category=self.state.sme_category,
            )

        task = make_generate_proof_task(
            sme_address=self.state.sme_address,
            days=self.state.days,
            sme_name=self.state.sme_name,
            sme_category=self.state.sme_category,
        )
        crew = Crew(agents=[blockchain_agent], tasks=[task], verbose=True)
        result = crew.kickoff()
        return result.raw