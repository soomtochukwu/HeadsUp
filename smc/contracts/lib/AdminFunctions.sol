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
     * @dev Update supported ERC20 token
     */
    function updateSupportedToken(address token, bool supported, uint8 decimals) external onlyOwner {
        require(token != address(0), "Invalid address");
        isSupportedToken[token] = supported;
        tokenDecimals[token] = decimals;
        emit TokenUpdated(token);
    }

    /**
     * @dev Allows a referrer to claim their accrued rewards for a specific token
     */
    function claimReferralRewards(address token) external whenNotPaused {
        uint256 amount = 0;

        if (token == address(0)) {
            amount = referralEarningsCELO[msg.sender];
            require(amount > 0, "No CELO rewards");
            referralEarningsCELO[msg.sender] = 0;
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "CELO transfer failed");
        } else if (token == cUSD) {
            amount = referralEarningsCUSD[msg.sender];
            require(amount > 0, "No cUSD rewards");
            referralEarningsCUSD[msg.sender] = 0;
            require(IERC20(cUSD).transfer(msg.sender, amount), "cUSD transfer failed");
        } else {
            amount = referralEarningsToken[msg.sender][token];
            require(amount > 0, "No token rewards");
            referralEarningsToken[msg.sender][token] = 0;
            require(IERC20(token).transfer(msg.sender, amount), "Token transfer failed");
        }

        emit ReferralRewardClaimed(msg.sender, token, amount);
    }

    /**
     * @dev Allows a referrer to claim their accrued rewards (Legacy CELO and cUSD)

     */
    function updateSupportedToken(address token, bool supported, uint8 decimals) external onlyOwner {
        require(token != address(0), "Invalid address");
        isSupportedToken[token] = supported;
        tokenDecimals[token] = decimals;
        emit TokenUpdated(token);
    }

    /**
     * @dev Allows a referrer to claim their accrued rewards for a specific token
     */
    function claimReferralRewards(address token) external whenNotPaused {
        uint256 amount = 0;
        
        if (token == address(0)) {
            amount = referralEarningsCELO[msg.sender];
            require(amount > 0, "No CELO rewards");
            referralEarningsCELO[msg.sender] = 0;
            (bool success, ) = payable(msg.sender).call{value: amount}("");
            require(success, "CELO transfer failed");
        } else if (token == cUSD) {
            amount = referralEarningsCUSD[msg.sender];
            require(amount > 0, "No cUSD rewards");
            referralEarningsCUSD[msg.sender] = 0;
            require(IERC20(cUSD).transfer(msg.sender, amount), "cUSD transfer failed");
        } else {
            amount = referralEarningsToken[msg.sender][token];
            require(amount > 0, "No token rewards");
            referralEarningsToken[msg.sender][token] = 0;
            require(IERC20(token).transfer(msg.sender, amount), "Token transfer failed");
        }

        emit ReferralRewardClaimed(msg.sender, token, amount);
    }

    /**
     * @dev Allows a referrer to claim their accrued rewards (Legacy CELO and cUSD)
     */
    function claimReferralRewards() external whenNotPaused {
        uint256 celoRewards = referralEarningsCELO[msg.sender];
        uint256 cusdRewards = referralEarningsCUSD[msg.sender];

        require(celoRewards > 0 || cusdRewards > 0, "No rewards to claim");

        // Transfer CELO
        if (celoRewards > 0) {
            referralEarningsCELO[msg.sender] = 0;
            (bool success, ) = payable(msg.sender).call{value: celoRewards}("");
            require(success, "CELO transfer failed");
            emit ReferralRewardClaimed(msg.sender, address(0), celoRewards);
        }

        // Transfer cUSD
        if (cusdRewards > 0) {
            referralEarningsCUSD[msg.sender] = 0;
            require(IERC20(cUSD).transfer(msg.sender, cusdRewards), "cUSD transfer failed");
            emit ReferralRewardClaimed(msg.sender, cUSD, cusdRewards);
        }
    }

    /**
     * @dev Admin function to set onboarding bonus amounts
     */
    function updateOnboardingBonus(uint256 _celoAmount, uint256 _cusdAmount) external onlyOwner {
        onboardingBonusCELO = _celoAmount;
        onboardingBonusCUSD = _cusdAmount;
        emit OnboardingBonusUpdated(_celoAmount, _cusdAmount);
    }

    /**
     * @dev Allows users to claim their one-time onboarding bonus
     * @param token Address of the token to claim (address(0) for CELO, or supported ERC20)
     */
    function claimOnboardingBonus(address token) external whenNotPaused {
        require(!hasClaimedOnboardingBonus[msg.sender], "Already claimed");
        require(playerGames[msg.sender].length > 0, "Must play at least once");
        require(refereeCount[msg.sender] > 0, "Must refer at least one friend");

        uint256 amountToClaim = 0;
        if (token == address(0)) {
            amountToClaim = onboardingBonusCELO;
            require(amountToClaim > 0, "CELO bonus not active");
            require(address(this).balance >= amountToClaim, "Insufficient contract balance");
            
            hasClaimedOnboardingBonus[msg.sender] = true;
            (bool success, ) = payable(msg.sender).call{value: amountToClaim}("");
            require(success, "CELO transfer failed");
            
            emit OnboardingBonusClaimed(msg.sender, address(0), amountToClaim);
        } else if (token == cUSD || isSupportedToken[token]) {
            uint8 decimals = token == cUSD ? 18 : tokenDecimals[token];
            if (decimals == 0) decimals = 18; // Default to 18 if not set

            // We need to scale onboardingBonusCUSD (which is in 18 decimals) to token decimals
            amountToClaim = onboardingBonusCUSD;
            if (decimals < 18) {
                amountToClaim = amountToClaim / (10 ** (18 - decimals));
            } else if (decimals > 18) {
                amountToClaim = amountToClaim * (10 ** (decimals - 18));
            }

            require(amountToClaim > 0, "Stable bonus not active");
            require(IERC20(token).balanceOf(address(this)) >= amountToClaim, "Insufficient contract token balance");
            
            hasClaimedOnboardingBonus[msg.sender] = true;
            require(IERC20(token).transfer(msg.sender, amountToClaim), "Token transfer failed");
            
            emit OnboardingBonusClaimed(msg.sender, token, amountToClaim);
        } else {
            revert("Unsupported token");
        }
    }
}
