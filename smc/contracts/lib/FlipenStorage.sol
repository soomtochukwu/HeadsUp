// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract FlipenStorage is Initializable {
    enum GameStatus { PENDING, FULFILLED, CANCELLED, EXPIRED }

    // Game state
    struct GameRequest {
        address player;
        uint256 amount;
        uint8 playerChoice; // 0 for tails, 1 for heads
        GameStatus status;
        bool won;
        uint256 timestamp;
        uint256 commitBlock; // The block number when the bet was placed
        uint256 randomNumber; // Store the generated random number
        uint8 coinResult; // Store the final coin flip result
        address token; // Address of the token used (address(0) for native CELO)
    }

    mapping(uint256 => GameRequest) internal gameRequests;
    mapping(address => uint256[]) internal playerGames;
    
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
    uint256 internal constant BLOCK_EXPIRATION = 250; // Blockhash only available for last 256 blocks

    // Minimum and maximum bet amounts
    uint256 internal minBetAmount;
    uint256 internal maxBetAmount;

    // Token configuration
    address public cUSD;

    // Events for Frontend Tracking
    event GameRequested(
        uint256 indexed requestId,
        address indexed player,
        uint256 amount,
        uint8 playerChoice,
        uint256 commitBlock,
        address token,
        address referrer
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
    
    // Referral & Economics Events
    event ReferralBound(address indexed player, address indexed referrer);
    event ReferralRewardAccrued(address indexed referrer, address indexed token, uint256 amount);
    event ReferralRewardClaimed(address indexed referrer, address indexed token, uint256 amount);
    event EconomicsUpdated(uint256 newHouseEdgeBP, uint256 newReferralRewardBP);

    // --- V2 Storage Appended Below ---
    mapping(address => address) public referrers;
    mapping(address => uint256) public referralEarningsCELO;
    mapping(address => uint256) public referralEarningsCUSD;

    uint256 public currentHouseEdgeBP;
    uint256 public currentReferralRewardBP;

    mapping(address => uint256) public refereeCount;

    // --- V3 Storage Appended Below ---
    uint256 public onboardingBonusCELO;
    uint256 public onboardingBonusCUSD;
    mapping(address => bool) public hasClaimedOnboardingBonus;
    
    event OnboardingBonusUpdated(uint256 celoAmount, uint256 cusdAmount);
    event OnboardingBonusClaimed(address indexed player, address indexed token, uint256 amount);
    // ---------------------------------

    // --- V4 Storage Appended Below ---
    mapping(address => bool) public isSupportedToken;
    mapping(address => mapping(address => uint256)) public referralEarningsToken;
    mapping(address => uint8) public tokenDecimals;
    // ---------------------------------

    function __FlipenStorage_init() internal onlyInitializing {
        minBetAmount = 0.01 ether; 
        maxBetAmount = 100 ether; 
        gameCounter = 1; 
        // Celo Sepolia cUSD address
        cUSD = 0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1; 
        
        // V2 Initialization
        currentHouseEdgeBP = 250; // 2.5% default
        currentReferralRewardBP = 100; // 1.0% default
    }
}
