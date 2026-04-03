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
     * @dev Emergency function to fund contract for game payouts
     */
    function fundContract() external payable onlyOwner {
        require(msg.value > 0, "Must send some funds");
    }
}
