// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract BlueSMETracker {
    struct BusinessActivity {
        uint256 timestamp;
        string activityType;     // "sale", "expense", "weekly_summary"
        uint256 amount;          // in KES
        string description;
        string category;         // "fisheries", "marine_tourism", "boat_operations"
    }

    // Authorised agent address — set once at deploy time
    address public immutable agent;

    // SME wallet → list of their activities
    mapping(address => BusinessActivity[]) public activities;

    event ActivityLogged(
        address indexed sme,
        uint256 timestamp,
        string activityType,
        uint256 amount,
        string description,
        string category
    );

    constructor(address _agent) {
        agent = _agent;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "BlueSMETracker: caller is not the authorised agent");
        _;
    }

    // ── SME logs their own activity directly ──────────────────
    function logActivity(
        string memory _activityType,
        uint256 _amount,
        string memory _description,
        string memory _category
    ) public {
        _log(msg.sender, _activityType, _amount, _description, _category);
    }

    // ── Agent logs on behalf of an SME (FIX for Bug #5) ──────
    // Only the authorised agent wallet can call this.
    function logActivityFor(
        address _sme,
        string memory _activityType,
        uint256 _amount,
        string memory _description,
        string memory _category
    ) public onlyAgent {
        _log(_sme, _activityType, _amount, _description, _category);
    }

    function _log(
        address _sme,
        string memory _activityType,
        uint256 _amount,
        string memory _description,
        string memory _category
    ) internal {
        BusinessActivity memory act = BusinessActivity({
            timestamp: block.timestamp,
            activityType: _activityType,
            amount: _amount,
            description: _description,
            category: _category
        });

        activities[_sme].push(act);

        emit ActivityLogged(
            _sme,
            block.timestamp,
            _activityType,
            _amount,
            _description,
            _category
        );
    }

    function getActivities(address _sme) public view returns (BusinessActivity[] memory) {
        return activities[_sme];
    }

    function getSummary(address _sme) public view returns (
        uint256 totalSales,
        uint256 totalExpenses,
        uint256 netProfit
    ) {
        BusinessActivity[] memory acts = activities[_sme];
        for (uint i = 0; i < acts.length; i++) {
            if (keccak256(bytes(acts[i].activityType)) == keccak256(bytes("sale"))) {
                totalSales += acts[i].amount;
            } else if (keccak256(bytes(acts[i].activityType)) == keccak256(bytes("expense"))) {
                totalExpenses += acts[i].amount;
            }
        }
        netProfit = totalSales > totalExpenses ? totalSales - totalExpenses : 0;
    }
}