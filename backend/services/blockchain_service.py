import os
from typing import List, Dict, Any, Tuple

# Abstracted interface
class BlockchainService:
    def __init__(self):
        self.is_test_mode = os.getenv("BLUESME_TEST_MODE", "0") == "1"

    def get_activities(self, sme_address: str) -> List[Dict[str, Any]]:
        """
        Fetch all transactions from the blockchain for a given SME.
        Returns a list of dicts: { "timestamp", "activityType", "amount", "description", "category", "tx_hash" }
        """
        if self.is_test_mode or True: # For now, assume mock blockchain is used until Web3 is deployed
            try:
                from contracts.mock_blockchain import get_activities_with_hash
                return get_activities_with_hash(sme_address)
            except ImportError:
                # If the function doesn't exist yet, we can build it. 
                # Let's read from mock_blockchain state directly for reconciliation
                import json
                mock_state_file = os.path.join(
                    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 
                    "contracts", 
                    "mock_chain_state.json"
                )
                if os.path.exists(mock_state_file):
                    try:
                        with open(mock_state_file, "r") as f:
                            state = json.load(f)
                            return state.get(sme_address, [])
                    except Exception:
                        pass
                return []
        else:
            # Future Web3 integration
            raise NotImplementedError("Live Base Sepolia integration not yet implemented")

blockchain_service = BlockchainService()
