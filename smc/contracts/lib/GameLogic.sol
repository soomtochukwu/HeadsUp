// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./FlipenStorage.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

abstract contract ReentrancyGuardUpgradeable is Initializable {
    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    /// @custom:storage-location erc7201:openzeppelin.storage.ReentrancyGuard
    struct ReentrancyGuardStorage {
        uint256 _status;
    }
    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.ReentrancyGuard")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant ReentrancyGuardStorageLocation = 0x9b779b17422d0df92223018b32b4d1fa46e071723d6817e2486d003becc55f00;

    function _getReentrancyGuardStorage() private pure returns (ReentrancyGuardStorage storage $) {
        assembly {
            $.slot := ReentrancyGuardStorageLocation
        }
    }

    function __ReentrancyGuard_init() internal onlyInitializing {
        _getReentrancyGuardStorage()._status = NOT_ENTERED;
    }

    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        require($._status != ENTERED, "ReentrancyGuard: reentrant call");
        $._status = ENTERED;
    }

    function _nonReentrantAfter() private {
        ReentrancyGuardStorage storage $ = _getReentrancyGuardStorage();
        $._status = NOT_ENTERED;
    }
}

abstract contract GameLogic is
    FlipenStorage,
    ReentrancyGuardUpgradeable
{
    function __GameLogic_init() internal onlyInitializing {
        __ReentrancyGuard_init();
    }

    /**
     * @dev Step 1: Commitment - Place a bet with native CELO
     */
    function flipCoin(uint8 choice, address referrer) external payable nonReentrant {
        _playGame(choice, msg.value, address(0), referrer);
    }

    /**
     * @dev Step 1: Commitment - Place a bet with cUSD or other ERC20
     */
    function flipCoinERC20(uint8 choice, uint256 amount, address token, address referrer) external nonReentrant {
        require(token == cUSD || isSupportedToken[token], "Token not supported");
        
        // Transfer tokens from player to contract
        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Token transfer failed");
        
        _playGame(choice, amount, token, referrer);
    }

    /**
     * @dev Internal game logic to store commitment
     */
    function _playGame(uint8 choice, uint256 amount, address token, address referrer) internal {
        require(
            choice == 0 || choice == 1,
            "Invalid choice: must be 0 (tails) or 1 (heads)"
        );

        // Normalize amount to 18 decimals for limit checks
        uint256 normalizedAmount = _getNormalizedAmount(amount, token);
        require(normalizedAmount >= minBetAmount, "Bet amount too low");
        require(normalizedAmount <= maxBetAmount, "Bet amount too high");
        
        // Dynamic payout calculation based on current house edge
        // House Edge of 2.5% (250) means a payout of 1.95x (19500)
        // Formula: 20000 - (2 * currentHouseEdgeBP)
        uint256 dynamicPayoutPercentage = 20000 - (2 * currentHouseEdgeBP);
        uint256 potentialPayout = (amount * dynamicPayoutPercentage) / BASIS_POINTS;
        
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

        // Referral Binding Logic
        if (referrer != address(0) && referrer != msg.sender && referrers[msg.sender] == address(0)) {
            referrers[msg.sender] = referrer;
            refereeCount[referrer]++;
            emit ReferralBound(msg.sender, referrer);
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

        emit GameRequested(gameId, msg.sender, amount, choice, block.number, token, referrers[msg.sender]);
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

        // Referral Reward Accrual (happens regardless of win/loss)
        address activeReferrer = referrers[game.player];
        if (activeReferrer != address(0)) {
            uint256 referralReward = (game.amount * currentReferralRewardBP) / BASIS_POINTS;
            if (game.token == address(0)) {
                referralEarningsCELO[activeReferrer] += referralReward;
            } else if (game.token == cUSD) {
                referralEarningsCUSD[activeReferrer] += referralReward;
            } else {
                referralEarningsToken[activeReferrer][game.token] += referralReward;
            }
            emit ReferralRewardAccrued(activeReferrer, game.token, referralReward);
        }

        if (won) {
            uint256 dynamicPayoutPercentage = 20000 - (2 * currentHouseEdgeBP);
            payout = (game.amount * dynamicPayoutPercentage) / BASIS_POINTS;
            
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

    /**
     * @dev Normalize amount to 18 decimals
     */
    function _getNormalizedAmount(uint256 amount, address token) internal view returns (uint256) {
        if (token == address(0)) return amount; // CELO is 18 decimals
        
        uint8 decimals = tokenDecimals[token];
        if (decimals == 0) {
            // Default to 18 if not set (for cUSD or unset tokens)
            return amount;
        }
        
        if (decimals < 18) {
            return amount * (10 ** (18 - decimals));
        } else if (decimals > 18) {
            return amount / (10 ** (decimals - 18));
        }
        return amount;
    }
}
