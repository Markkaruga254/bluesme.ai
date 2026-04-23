import os
from web3 import Web3
from dotenv import load_dotenv

load_dotenv()

CONTRACT_ABI = [
    {
        "inputs": [{"internalType": "address", "name": "_agent", "type": "address"}],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    # logActivity — SME calls directly
    {
        "inputs": [
            {"internalType": "string", "name": "_activityType", "type": "string"},
            {"internalType": "uint256", "name": "_amount", "type": "uint256"},
            {"internalType": "string", "name": "_description", "type": "string"},
            {"internalType": "string", "name": "_category", "type": "string"}
        ],
        "name": "logActivity",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    # logActivityFor — agent calls on behalf of SME (FIX for Bug #5)
    {
        "inputs": [
            {"internalType": "address", "name": "_sme", "type": "address"},
            {"internalType": "string", "name": "_activityType", "type": "string"},
            {"internalType": "uint256", "name": "_amount", "type": "uint256"},
            {"internalType": "string", "name": "_description", "type": "string"},
            {"internalType": "string", "name": "_category", "type": "string"}
        ],
        "name": "logActivityFor",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "_sme", "type": "address"}],
        "name": "getActivities",
        "outputs": [
            {
                "components": [
                    {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
                    {"internalType": "string", "name": "activityType", "type": "string"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"},
                    {"internalType": "string", "name": "description", "type": "string"},
                    {"internalType": "string", "name": "category", "type": "string"}
                ],
                "internalType": "struct BlueSMETracker.BusinessActivity[]",
                "name": "",
                "type": "tuple[]"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "_sme", "type": "address"}],
        "name": "getSummary",
        "outputs": [
            {"internalType": "uint256", "name": "totalSales", "type": "uint256"},
            {"internalType": "uint256", "name": "totalExpenses", "type": "uint256"},
            {"internalType": "uint256", "name": "netProfit", "type": "uint256"}
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True,  "internalType": "address", "name": "sme",          "type": "address"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp",    "type": "uint256"},
            {"indexed": False, "internalType": "string",  "name": "activityType", "type": "string"},
            {"indexed": False, "internalType": "uint256", "name": "amount",       "type": "uint256"},
            {"indexed": False, "internalType": "string",  "name": "description",  "type": "string"},
            {"indexed": False, "internalType": "string",  "name": "category",     "type": "string"}
        ],
        "name": "ActivityLogged",
        "type": "event"
    }
]


def get_web3() -> Web3:
    rpc_url = os.getenv("BASE_SEPOLIA_RPC_URL")
    if not rpc_url:
        raise ValueError("BASE_SEPOLIA_RPC_URL not set in .env")
    w3 = Web3(Web3.HTTPProvider(rpc_url))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to Base Sepolia at {rpc_url}")
    return w3


def get_contract(w3: Web3):
    address = os.getenv("CONTRACT_ADDRESS")
    if not address or address == "0x0000000000000000000000000000000000000000":
        raise ValueError("CONTRACT_ADDRESS not set — deploy BlueSMETracker.sol on Remix first")
    return w3.eth.contract(
        address=Web3.to_checksum_address(address),
        abi=CONTRACT_ABI
    )


def get_agent_account(w3: Web3):
    private_key = os.getenv("AGENT_PRIVATE_KEY")
    if not private_key:
        raise ValueError("AGENT_PRIVATE_KEY not set in .env")
    return w3.eth.account.from_key(private_key)