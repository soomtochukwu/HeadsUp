// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./FlipenStorage.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/libraries/VRFV2PlusClient.sol";
import "@chainlink/contracts/src/v0.8/vrf/dev/IVRFCoordinatorV2Plus.sol";

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
    function flipCoin(uint8 choice) external payable nonReentrant {
        _playGame(choice, msg.value, address(0));
    }

    /**
     * @dev Main function for players to flip coin with cUSD or other ERC20
     */
    function flipCoinERC20(uint8 choice, uint256 amount, address token) external nonReentrant {
        require(token == cUSD, "Only cUSD supported for now");
        
        // Transfer tokens from player to contract
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        
        _playGame(choice, amount, token);
    }

    /**
     * @dev Internal game logic to request VRF
     */
    function _playGame(uint8 choice, uint256 amount, address token) internal {
        require(
            choice == 0 || choice == 1,
            "Invalid choice: must be 0 (tails) or 1 (heads)"
        );
        require(amount >= minBetAmount, "Bet amount too low");
        require(amount <= maxBetAmount, "Bet amount too high");
        require(vrfConfig.subscriptionId != 0, "VRF Subscription not set");
        
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

        // Request VRF
        uint256 vrfRequestId = IVRFCoordinatorV2Plus(address(s_vrfCoordinator)).requestRandomWords(
            VRFV2PlusClient.RandomWordsRequest({
                keyHash: vrfConfig.keyHash,
                subId: vrfConfig.subscriptionId,
                requestConfirmations: vrfConfig.requestConfirmations,
                callbackGasLimit: vrfConfig.callbackGasLimit,
                numWords: 1,
                extraArgs: VRFV2PlusClient._argsToBytes(
                    VRFV2PlusClient.ExtraArgsV1({nativePayment: true}) // Pay VRF in CELO
                )
            })
        );

        // Map VRF request to Game ID
        vrfToGameRequestId[vrfRequestId] = gameId;

        // Store game request as PENDING
        gameRequests[gameId] = GameRequest({
            player: msg.sender,
            amount: amount,
            playerChoice: choice,
            status: GameStatus.PENDING,
            won: false,
            timestamp: block.timestamp,
            randomNumber: 0,
            coinResult: 0,
            token: token
        });

        playerGames[msg.sender].push(gameId);
        totalGamesPlayed++;
        totalVolume += amount;

        emit GameRequested(gameId, vrfRequestId, msg.sender, amount, choice, block.timestamp, token);
    }

    /**
     * @dev Callback handler for VRF fulfillment
     */
    function _fulfillGame(uint256 vrfRequestId, uint256 randomNumber) internal {
        uint256 gameId = vrfToGameRequestId[vrfRequestId];
        GameRequest storage game = gameRequests[gameId];
        
        require(game.player != address(0), "Game not found");
        require(game.status == GameStatus.PENDING, "Game already fulfilled");

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
                // If transfer fails, we don't revert (to avoid blocking VRF), but we log it
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
     * @dev Get game details by request ID
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
