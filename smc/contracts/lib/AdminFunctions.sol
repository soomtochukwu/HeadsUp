// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "./FlipenStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract AdminFunctions is
    FlipenStorage,
    OwnableUpgradeable,
    PausableUpgradeable
{
    function __AdminFunctions_init(
        address initialOwner
    ) internal onlyInitializing {
        __Ownable_init(initialOwner);
        __Pausable_init();
    }

    /**
     * @dev Update cUSD token address
     */
    function updateCUSD(address _cUSD) external onlyOwner {
        require(_cUSD != address(0), "Invalid address");
        cUSD = _cUSD;
        emit TokenUpdated(_cUSD);
    }

    /**
     * @dev Withdraw CELO from contract
     */
    function withdrawCELO(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance, "Insufficient balance");
        (bool success, ) = payable(owner()).call{value: amount}("");
        require(success, "Transfer failed");
        emit FundsWithdrawn(owner(), address(0), amount);
    }

    /**
     * @dev Withdraw ERC20 tokens from contract
     */
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        require(token != address(0), "Use withdrawCELO");
        require(IERC20(token).transfer(owner(), amount), "Transfer failed");
        emit FundsWithdrawn(owner(), token, amount);
    }

    /**
     * @dev Update betting limits
     */
    function updateBetLimits(
        uint256 newMinBet,
        uint256 newMaxBet
    ) external onlyOwner {
        require(newMinBet > 0, "Min bet must be greater than 0");
        require(newMaxBet > newMinBet, "Max bet must be greater than min bet");

        minBetAmount = newMinBet;
        maxBetAmount = newMaxBet;

        emit BetLimitsUpdated(newMinBet, newMaxBet);
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Get current bet limits
     */
    function getBetLimits() external view returns (uint256 min, uint256 max) {
        return (minBetAmount, maxBetAmount);
    }

    /**
     * @dev Emergency function to fund contract for game payouts
     */
    function fundContract() external payable onlyOwner {
        require(msg.value > 0, "Must send some funds");
    }

    /**
     * @dev Admin function to tune protocol economics
     * @param newHouseEdgeBP The new house edge in basis points (e.g. 250 = 2.5%)
     * @param newReferralRewardBP The new referral reward in basis points (e.g. 100 = 1%)
     */
    function updateEconomics(uint256 newHouseEdgeBP, uint256 newReferralRewardBP) external onlyOwner {
        // Enforce strict mathematical constraint: Referral reward MUST be less than house edge
        // to guarantee protocol profitability and prevent Sybil attacks.
        require(newReferralRewardBP < newHouseEdgeBP, "Referral reward must be < house edge");
        require(newHouseEdgeBP <= 1000, "House edge too high (max 10%)"); // Reasonable upper bound

        currentHouseEdgeBP = newHouseEdgeBP;
        currentReferralRewardBP = newReferralRewardBP;

        emit EconomicsUpdated(newHouseEdgeBP, newReferralRewardBP);
    }

    /**
     * @dev Allows a referrer to claim their accrued rewards (CELO and cUSD)
     */
    function claimReferralRewards() external whenNotPaused {
        uint256 celoRewards = referralEarningsCELO[msg.sender];
        uint256 cusdRewards = referralEarningsCUSD[msg.sender];

        require(celoRewards > 0 || cusdRewards > 0, "No rewards to claim");

        // Reset balances before transfer (Checks-Effects-Interactions)
        if (celoRewards > 0) {
            referralEarningsCELO[msg.sender] = 0;
        }
        if (cusdRewards > 0) {
            referralEarningsCUSD[msg.sender] = 0;
        }

        // Transfer CELO
        if (celoRewards > 0) {
            (bool success, ) = payable(msg.sender).call{value: celoRewards}("");
            require(success, "CELO transfer failed");
            emit ReferralRewardClaimed(msg.sender, address(0), celoRewards);
        }

        // Transfer cUSD
        if (cusdRewards > 0) {
            bool success = IERC20(cUSD).transfer(msg.sender, cusdRewards);
            require(success, "cUSD transfer failed");
            emit ReferralRewardClaimed(msg.sender, cUSD, cusdRewards);
        }
    }
}
