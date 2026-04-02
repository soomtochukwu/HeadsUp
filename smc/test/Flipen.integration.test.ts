import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Flipen, MockVRFCoordinator } from "../typechain-types";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

describe("Flipen Integration Tests", function () {
  let flipen: Flipen;
  let owner: HardhatEthersSigner;
  let players: HardhatEthersSigner[];
  let mockVRFCoordinator: MockVRFCoordinator;

  // Environment variables with fallbacks
  const SUBSCRIPTION_ID = parseInt(process.env.VRF_SUBSCRIPTION_ID || "1");
  const KEY_HASH = process.env.VRF_KEY_HASH_ALFAJORES || "0x6e75b569a01ef56d18cab6a8e71e6600d6ce853834d4a5748b720d06f878b3a4";
  const VRF_COORDINATOR = process.env.VRF_COORDINATOR_ALFAJORES || "0x8C7382F9D8f56b33781fE506E897a4F1e2d17255";

  beforeEach(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    players = signers.slice(1, 6); // 5 players for testing

    // Deploy mock VRF Coordinator
    const MockVRFCoordinatorFactory = await ethers.getContractFactory(
      "MockVRFCoordinator"
    );
    mockVRFCoordinator = await MockVRFCoordinatorFactory.deploy() as MockVRFCoordinator;
    await mockVRFCoordinator.waitForDeployment();

    // Deploy Flipen
    const FlipenFactory = await ethers.getContractFactory("Flipen");
    flipen = await upgrades.deployProxy(
      FlipenFactory,
      [
        owner.address,
        await mockVRFCoordinator.getAddress(),
        SUBSCRIPTION_ID,
        KEY_HASH,
      ],
      { initializer: "initialize" }
    ) as Flipen;
    await flipen.waitForDeployment();

    // Fund contract
    await owner.sendTransaction({
      to: await flipen.getAddress(),
      value: ethers.parseEther("1000"),
    });
  });

  it("Should handle multiple players and games correctly", async function () {
    const betAmount = ethers.parseEther("1");
    const gamePromises = [];

    // All players place bets
    for (let i = 0; i < players.length; i++) {
      gamePromises.push(
        flipen.connect(players[i]).flipCoin(i % 2, { value: betAmount })
      );
    }

    await Promise.all(gamePromises);

    // Check total games
    const [totalGames, volume] = await flipen.getContractStats();
    expect(totalGames).to.equal(players.length);
    expect(volume).to.equal(betAmount * BigInt(players.length));

    // Fulfill all games with different outcomes
    for (let i = 1; i <= players.length; i++) {
      await mockVRFCoordinator.fulfillRandomWords(i, [i % 2]);
    }

    // Verify game outcomes
    for (let i = 1; i <= players.length; i++) {
      const game = await flipen.getGameDetails(i);
      expect(game.fulfilled).to.be.true;

      // Players with matching choices should win
      const expectedWin = (i - 1) % 2 === i % 2;
      expect(game.won).to.equal(expectedWin);
    }
  });

  it("Should maintain correct contract balance through multiple games", async function () {
    const initialBalance = await ethers.provider.getBalance(
      await flipen.getAddress()
    );
    const betAmount = ethers.parseEther("10");

    // Player 1 loses
    await flipen.connect(players[0]).flipCoin(1, { value: betAmount });
    await mockVRFCoordinator.fulfillRandomWords(1, [0]); // Tails, player chose heads

    // Player 2 wins
    await flipen.connect(players[1]).flipCoin(1, { value: betAmount });
    await mockVRFCoordinator.fulfillRandomWords(2, [1]); // Heads, player chose heads

    const finalBalance = await ethers.provider.getBalance(
      await flipen.getAddress()
    );

    // Contract should have gained from losing bet and lost from winning bet
    const expectedChange =
      betAmount - (betAmount * BigInt(9750)) / BigInt(10000);
    expect(finalBalance).to.be.approximately(
      initialBalance + expectedChange,
      ethers.parseEther("0.01")
    );
  });

  it("Should handle contract upgrade with existing games", async function () {
    const betAmount = ethers.parseEther("1");

    // Place a bet
    await flipen.connect(players[0]).flipCoin(1, { value: betAmount });

    // Upgrade contract
    const FlipenV2Factory = await ethers.getContractFactory("Flipen");
    const upgraded = await upgrades.upgradeProxy(
      await flipen.getAddress(),
      FlipenV2Factory
    ) as Flipen;

    // Fulfill the game after upgrade
    await mockVRFCoordinator.fulfillRandomWords(1, [1]);

    // Verify game was fulfilled correctly
    const game = await upgraded.getGameDetails(1);
    expect(game.fulfilled).to.be.true;
    expect(game.won).to.be.true;
  });

  it("Should handle high volume of simultaneous games", async function () {
    const betAmount = ethers.parseEther("0.5");
    const numGames = 10;
    const gamePromises = [];

    // Create multiple games from different players
    for (let i = 0; i < numGames; i++) {
      const playerIndex = i % players.length;
      const choice = i % 2; // Alternate between heads and tails
      
      gamePromises.push(
        flipen.connect(players[playerIndex]).flipCoin(choice, { value: betAmount })
      );
    }

    // Execute all games simultaneously
    await Promise.all(gamePromises);

    // Verify all games were created
    const [totalGames, volume] = await flipen.getContractStats();
    expect(totalGames).to.equal(numGames);
    expect(volume).to.equal(betAmount * BigInt(numGames));

    // Fulfill all games with random outcomes
    const fulfillPromises = [];
    for (let i = 1; i <= numGames; i++) {
      const randomOutcome = Math.floor(Math.random() * 2); // 0 or 1
      fulfillPromises.push(
        mockVRFCoordinator.fulfillRandomWords(i, [randomOutcome])
      );
    }

    await Promise.all(fulfillPromises);

    // Verify all games are fulfilled
    for (let i = 1; i <= numGames; i++) {
      const game = await flipen.getGameDetails(i);
      expect(game.fulfilled).to.be.true;
    }
  });

  it("Should handle edge case: contract balance depletion and recovery", async function () {
    // Drain most of the contract balance
    const contractBalance = await ethers.provider.getBalance(await flipen.getAddress());
    const withdrawAmount = contractBalance - ethers.parseEther("10");
    
    await flipen.connect(owner).withdrawFunds(withdrawAmount);

    // Try to place a large bet that would exceed available balance for payout
    const largeBet = ethers.parseEther("15");
    await expect(
      flipen.connect(players[0]).flipCoin(1, { value: largeBet })
    ).to.be.revertedWith("Insufficient contract balance for potential payout");

    // Refund the contract
    await owner.sendTransaction({
      to: await flipen.getAddress(),
      value: ethers.parseEther("100"),
    });

    // Now the large bet should work
    await expect(
      flipen.connect(players[0]).flipCoin(1, { value: largeBet })
    ).to.emit(flipen, "GameRequested");
  });

  it("Should maintain game history integrity across multiple operations", async function () {
    const betAmount = ethers.parseEther("1");
    const player = players[0];

    // Player makes multiple games
    await flipen.connect(player).flipCoin(1, { value: betAmount });
    await flipen.connect(player).flipCoin(0, { value: betAmount });
    await flipen.connect(player).flipCoin(1, { value: betAmount });

    // Fulfill games with different outcomes
    await mockVRFCoordinator.fulfillRandomWords(1, [1]); // Win
    await mockVRFCoordinator.fulfillRandomWords(2, [1]); // Lose
    await mockVRFCoordinator.fulfillRandomWords(3, [0]); // Lose

    // Check player's game history
    const playerGames = await flipen.getPlayerGames(player.address);
    expect(playerGames.length).to.equal(3);

    // Verify individual game details
    const game1 = await flipen.getGameDetails(1);
    const game2 = await flipen.getGameDetails(2);
    const game3 = await flipen.getGameDetails(3);

    expect(game1.won).to.be.true;  // Choice 1, result 1
    expect(game2.won).to.be.false; // Choice 0, result 1
    expect(game3.won).to.be.false; // Choice 1, result 0

    // Verify all games belong to the same player
    expect(game1.player).to.equal(player.address);
    expect(game2.player).to.equal(player.address);
    expect(game3.player).to.equal(player.address);
  });

  it("Should handle admin operations during active games", async function () {
    const betAmount = ethers.parseEther("1");

    // Place some bets
    await flipen.connect(players[0]).flipCoin(1, { value: betAmount });
    await flipen.connect(players[1]).flipCoin(0, { value: betAmount });

    // Admin updates bet limits while games are pending
    const newMinBet = ethers.parseEther("0.02");
    const newMaxBet = ethers.parseEther("200");
    await flipen.connect(owner).updateBetLimits(newMinBet, newMaxBet);

    // Admin updates VRF settings
    const newSubscriptionId = 2;
    const newKeyHash = "0x1234567890123456789012345678901234567890123456789012345678901234";
    await flipen.connect(owner).updateVRFSettings(
      newSubscriptionId,
      newKeyHash,
      200000
    );

    // Fulfill pending games - should still work with old settings
    await mockVRFCoordinator.fulfillRandomWords(1, [1]);
    await mockVRFCoordinator.fulfillRandomWords(2, [0]);

    // Verify games were fulfilled correctly
    const game1 = await flipen.getGameDetails(1);
    const game2 = await flipen.getGameDetails(2);
    expect(game1.fulfilled).to.be.true;
    expect(game2.fulfilled).to.be.true;

    // New games should use updated settings
    const [, , , ] = await flipen.getVRFSettings();
    const [minBet, maxBet] = await flipen.getBetLimits();
    expect(minBet).to.equal(newMinBet);
    expect(maxBet).to.equal(newMaxBet);
  });
});
