// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./FlipenStorage.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract GameLogic is
    FlipenStorage,
    ReentrancyGuardUpgradeable
{
    function __GameLogic_init() internal onlyInitializing {
        __ReentrancyGuard_init();
    }

    /**
     * @dev Main function for players to flip coin with native CELO
     */
    function flipCoin(uint8 choice, uint256 randomNumber) external payable nonReentrant {
        _playGame(choice, randomNumber, msg.value, address(0));
    }

    /**
     * @dev Main function for players to flip coin with cUSD or other ERC20
     */
    function flipCoinERC20(uint8 choice, uint256 randomNumber, uint256 amount, address token) external nonReentrant {
        require(token == cUSD, "Only cUSD supported for now");
        
        // Transfer tokens from player to contract
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        
        _playGame(choice, randomNumber, amount, token);
    }

    /**
     * @dev Internal game logic shared between CELO and ERC20 bets
     */
    function _playGame(uint8 choice, uint256 randomNumber, uint256 amount, address token) internal {
        require(
            choice == 0 || choice == 1,
            "Invalid choice: must be 0 (tails) or 1 (heads)"
        );
        require(amount >= minBetAmount, "Bet amount too low");
        require(amount <= maxBetAmount, "Bet amount too high");
        
        uint256 potentialPayout = (amount * PAYOUT_PERCENTAGE) / BASIS_POINTS;
        
        if (token == address(0)) {
            require(
                address(this).balance >= potentialPayout,
                "Insufficient contract balance for potential payout"
            );
        } else {
            require(
                IERC20(token).balanceOf(address(this)) >= potentialPayout,
                "Insufficient contract token balance"
            );
        }
        
        require(randomNumber > 0, "Random number must be greater than 0");

        // Generate unique request ID
        uint256 requestId = gameCounter;
        gameCounter++;

        // Generate coin flip result (0 or 1) using modulo
        uint8 coinResult = uint8(randomNumber % 2);

        // Store game request
        gameRequests[requestId] = GameRequest({
            player: msg.sender,
            amount: amount,
            playerChoice: choice,
            fulfilled: true,
            won: coinResult == choice,
            timestamp: block.timestamp,
            randomNumber: randomNumber,
            coinResult: coinResult,
            token: token
        });

        playerGames[msg.sender].push(requestId);
        totalGamesPlayed++;
        totalVolume += amount;

        // Emit game requested event
        emit GameRequested(requestId, msg.sender, amount, choice, block.timestamp, token);

        // Process game result immediately
        uint256 payout = 0;
        if (coinResult == choice) {
            // Player won
            payout = potentialPayout;

            // Transfer winnings to player
            if (token == address(0)) {
                (bool success, ) = payable(msg.sender).call{value: payout}("");
                require(success, "CELO payout transfer failed");
            } else {
                require(IERC20(token).transfer(msg.sender, payout), "Token payout transfer failed");
            }
        }

        // Emit comprehensive game result event
        emit GameResult(
            requestId,
            msg.sender,
            amount,
            choice,
            coinResult,
            coinResult == choice,
            payout,
            randomNumber,
            block.timestamp,
            token
        );
        
        emit GameCompleted(requestId, msg.sender, coinResult == choice, payout, token);
    }

    /**
     * @dev Get the random number used for a specific game
     */
    function getGameRandomness(uint256 requestId) 
        external 
        view 
        returns (uint256 randomNumber, uint8 coinResult) 
    {
        GameRequest memory game = gameRequests[requestId];
        require(game.fulfilled, "Game not found or not fulfilled");
        return (game.randomNumber, game.coinResult);
    }

    /**
     * @dev Get player's game history
     */
    function getPlayerGames(
        address player
    ) external view returns (uint256[] memory) {
        return playerGames[player];
    }

    /**
     * @dev Get game details by request ID
     */
    function getGameDetails(
        uint256 requestId
    ) external view returns (GameRequest memory) {
        return gameRequests[requestId];
    }

    /**
     * @dev Get contract statistics (simplified for native only, or we can expand)
     */
    function getContractStats()
        external
        view
        returns (
            uint256 totalGames,
            uint256 volume,
            uint256 balance,
            uint256 fees
        )
    {
        return (
            totalGamesPlayed,
            totalVolume,
            address(this).balance,
            0 // Simplified for now
        );
    }

    /**
     * @dev Get current game counter
     */
    function getCurrentGameCounter() external view returns (uint256) {
        return gameCounter;
    }
}
