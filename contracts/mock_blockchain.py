import time
import uuid

import json
import os

MOCK_STATE_FILE = os.path.join(os.path.dirname(__file__), "mock_chain_state.json")

def _load_state():
    if os.path.exists(MOCK_STATE_FILE):
        try:
            with open(MOCK_STATE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def _save_state(state):
    with open(MOCK_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

# In-memory mock database for the blockchain, loaded from disk
MOCK_BLOCKCHAIN = _load_state()

def log_activity_for(sme_address: str, activity_type: str, amount: int, description: str, category: str):
    """Mocks the smart contract's logActivityFor method."""
    if sme_address not in MOCK_BLOCKCHAIN:
        MOCK_BLOCKCHAIN[sme_address] = []

    timestamp = int(time.time())
    tx_hash = "0x" + uuid.uuid4().hex

    MOCK_BLOCKCHAIN[sme_address].append({
        "timestamp": timestamp,
        "activityType": activity_type,
        "amount": amount,
        "description": description,
        "category": category,
        "tx_hash": tx_hash
    })
    
    _save_state(MOCK_BLOCKCHAIN)

    return tx_hash

def get_activities(sme_address: str):
    """Mocks the smart contract's getActivities method.
    Returns tuples of (timestamp, activityType, amount, description, category) to match contract format.
    """
    if sme_address not in MOCK_BLOCKCHAIN:
        return []

    activities = MOCK_BLOCKCHAIN[sme_address]
    # Return in the tuple format that the original tools expect
    return [(act["timestamp"], act["activityType"], act["amount"], act["description"], act["category"]) for act in activities]

def get_summary(sme_address: str):
    """Mocks the smart contract's getSummary method."""
    if sme_address not in MOCK_BLOCKCHAIN:
        return (0, 0, 0) # total_sales, total_expenses, net_profit

    activities = MOCK_BLOCKCHAIN[sme_address]

    total_sales = sum(act["amount"] for act in activities if act["activityType"] == "sale")
    total_expenses = sum(act["amount"] for act in activities if act["activityType"] == "expense")
    net_profit = total_sales - total_expenses

    return (total_sales, total_expenses, net_profit)

if __name__ == "__main__":
    test_sme = "0x1234567890abcdef"
    print("Testing mock blockchain...")

    # Test logging
    tx_hash = log_activity_for(test_sme, "sale", 5000, "Sold fish", "fisheries")
    assert tx_hash.startswith("0x")

    # Test getting activities
    acts = get_activities(test_sme)
    assert len(acts) == 1
    assert acts[0][1] == "sale"
    assert acts[0][2] == 5000

    # Test summary
    log_activity_for(test_sme, "expense", 2000, "Bought net", "fisheries")
    summary = get_summary(test_sme)
    assert summary == (5000, 2000, 3000)

    print("Mock blockchain tests passed!")
