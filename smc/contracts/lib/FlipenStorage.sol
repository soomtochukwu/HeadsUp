// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract FlipenStorage is Initializable {
    enum GameStatus { PENDING, FULFILLED, CANCELLED }

    // Game state
    struct GameRequest {
        address player;
        uint256 amount;
        uint8 playerChoice; // 0 for tails, 1 for heads
        GameStatus status;
        bool won;
        uint256 timestamp;
        uint256 randomNumber; // Store the random number from Chainlink
        uint8 coinResult; // Store the final coin flip result
        address token; // Address of the token used (address(0) for native CELO)
    }

    mapping(uint256 => GameRequest) internal gameRequests;
    mapping(address => uint256[]) internal playerGames;
    
    // VRF tracking
    mapping(uint256 => uint256) public vrfToGameRequestId;
    
    // Game counter for generating unique request IDs
    uint256 internal gameCounter;

    // Contract state
    uint256 internal totalGamesPlayed;
    uint256 internal totalVolume;
    uint256 internal platformFees;

    // Constants
    uint256 internal constant HOUSE_EDGE = 250; // 2.5% in basis points
    uint256 internal constant PAYOUT_PERCENTAGE = 19500; // 195% in basis points (1.95x)
    uint256 internal constant BASIS_POINTS = 10000;

    // Minimum and maximum bet amounts
    uint256 internal minBetAmount;
    uint256 internal maxBetAmount;

    // Token configuration
    address public cUSD;

    // VRF Configuration
    struct VRFConfig {
        uint256 subscriptionId;
        bytes32 keyHash;
        uint32 callbackGasLimit;
        uint16 requestConfirmations;
    }
    VRFConfig public vrfConfig;

    // Events for Frontend Tracking
    event GameRequested(
        uint256 indexed requestId,
        uint256 vrfRequestId,
        address indexed player,
        uint256 amount,
        uint8 playerChoice,
        uint256 timestamp,
        address token
    );
    
    event GameResult(
        uint256 indexed requestId,
        address indexed player,
        uint256 amount,
        uint8 playerChoice,
        uint8 result,
        bool won,
        uint256 payout,
        uint256 randomNumber,
        uint256 timestamp,
        address token
    );
    
    event GameCompleted(
        uint256 indexed requestId,
        address indexed player,
        bool won,
        uint256 payout,
        address token
    );
    
    event FundsWithdrawn(address indexed owner, address token, uint256 amount);
    event BetLimitsUpdated(uint256 minBet, uint256 maxBet);
    event TokenUpdated(address indexed token);
    event VRFConfigUpdated(uint256 subId, bytes32 keyHash, uint32 gasLimit);

    function __FlipenStorage_init() internal onlyInitializing {
        minBetAmount = 0.01 ether; 
        maxBetAmount = 100 ether; 
        gameCounter = 1; 
        // Celo Sepolia cUSD address: 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1
        cUSD = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1; 
        
        // Default VRF Config for Celo Sepolia
        vrfConfig = VRFConfig({
            subscriptionId: 0, // Must be set by admin
            keyHash: 0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be,
            callbackGasLimit: 200000,
            requestConfirmations: 3
        });
    }
}
