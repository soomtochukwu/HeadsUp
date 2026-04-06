// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./FlipenStorage.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract GameLogic is
    FlipenStorage,
    ReentrancyGuard
{
    function __GameLogic_init() internal onlyInitializing {
    }

    /**
     * @dev Step 1: Commitment - Place a bet with native CELO
     */
    function flipCoin(uint8 choice) external payable nonReentrant {
        _playGame(choice, msg.value, address(0));
    }

    /**
     * @dev Step 1: Commitment - Place a bet with cUSD or other ERC20
     */
    function flipCoinERC20(uint8 choice, uint256 amount, address token) external nonReentrant {
        require(token == cUSD, "Only cUSD supported for now");
        
        // Transfer tokens from player to contract
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        
        _playGame(choice, amount, token);
    }

    /**
     * @dev Internal game logic to store commitment
     */
    function _playGame(uint8 choice, uint256 amount, address token) internal {
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

        // Generate unique request ID
        uint256 gameId = gameCounter;
        gameCounter++;

        // Store game request as PENDING with commitBlock
        gameRequests[gameId] = GameRequest({
            player: msg.sender,
            amount: amount,
            playerChoice: choice,
            status: GameStatus.PENDING,
            won: false,
            timestamp: block.timestamp,
            commitBlock: block.number, // The block this transaction is mined in
            randomNumber: 0,
            coinResult: 0,
            token: token
        });

        playerGames[msg.sender].push(gameId);
        totalGamesPlayed++;
        totalVolume += amount;

        emit GameRequested(gameId, msg.sender, amount, choice, block.number, token);
    }

    /**
     * @dev Step 2: Resolution - Resolve game using future block entropy
     */
    function resolveGame(uint256 gameId) external nonReentrant {
        GameRequest storage game = gameRequests[gameId];
        
        require(game.player != address(0), "Game not found");
        require(game.status == GameStatus.PENDING, "Game already resolved");
        require(block.number > game.commitBlock, "Cannot resolve in the same block");
        
        // Anti-manipulation: Must resolve within 250 blocks
        if (block.number > game.commitBlock + BLOCK_EXPIRATION) {
            game.status = GameStatus.EXPIRED;
            emit GameCompleted(gameId, game.player, false, 0, game.token);
            return;
        }

        // Sophisticated Native Entropy Mix
        // Uses blockhash of the commit block (which was unknown when bet was placed)
        // plus other unpredictable environmental variables
        uint256 randomNumber = uint256(keccak256(abi.encodePacked(
            blockhash(game.commitBlock),
            block.prevrandao,
            block.timestamp,
            game.player,
            gameId
        )));

        uint8 coinResult = uint8(randomNumber % 2);
        bool won = (coinResult == game.playerChoice);
        uint256 payout = 0;

        game.randomNumber = randomNumber;
        game.coinResult = coinResult;
        game.won = won;
        game.status = GameStatus.FULFILLED;

        if (won) {
            payout = (game.amount * PAYOUT_PERCENTAGE) / BASIS_POINTS;
            
            if (game.token == address(0)) {
                (bool success, ) = payable(game.player).call{value: payout}("");
                if (!success) game.status = GameStatus.CANCELLED;
            } else {
                bool success = IERC20(game.token).transfer(game.player, payout);
                if (!success) game.status = GameStatus.CANCELLED;
            }
        }

        emit GameResult(
            gameId,
            game.player,
            game.amount,
            game.playerChoice,
            coinResult,
            won,
            payout,
            randomNumber,
            block.timestamp,
            game.token
        );
        
        emit GameCompleted(gameId, game.player, won, payout, game.token);
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
     * @dev Get game details
     */
    function getGameDetails(
        uint256 requestId
    ) external view returns (GameRequest memory) {
        return gameRequests[requestId];
    }

    /**
     * @dev Get contract statistics
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
            0
        );
    }
}
