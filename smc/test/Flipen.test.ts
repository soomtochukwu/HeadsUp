import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { Flipen, MockERC20 } from "../typechain-types";

describe("Flipen", function () {
  let flipen: Flipen;
  let owner: HardhatEthersSigner;
  let player1: HardhatEthersSigner;
  let player2: HardhatEthersSigner;
  let mockCUSD: MockERC20;
  
  const MIN_BET = ethers.parseEther("0.01");
  const MAX_BET = ethers.parseEther("100");
  const PAYOUT_PERCENTAGE = 19500; // 1.95x
  
  beforeEach(async function () {
    [owner, player1, player2] = await ethers.getSigners();
    
    // Deploy mock cUSD
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    mockCUSD = await MockERC20Factory.deploy("Celo Dollar", "cUSD") as MockERC20;
    await mockCUSD.waitForDeployment();
    
    // Deploy Flipen contract
    const FlipenFactory = await ethers.getContractFactory("Flipen");
    flipen = await upgrades.deployProxy(
      FlipenFactory,
      [owner.address],
      { initializer: "initialize" }
    ) as Flipen;
    await flipen.waitForDeployment();
    
    // Update cUSD address in contract to our mock
    await flipen.connect(owner).updateCUSD(await mockCUSD.getAddress());
    
    // Fund the contract for payouts (CELO)
    await owner.sendTransaction({
      to: await flipen.getAddress(),
      value: ethers.parseEther("1000")
    });
    
    // Fund the contract for payouts (cUSD)
    await mockCUSD.mint(await flipen.getAddress(), ethers.parseUnits("1000", 18));
  });
  
  describe("Deployment and Initialization", function () {
    it("Should set the right owner", async function () {
      expect(await flipen.owner()).to.equal(owner.address);
    });
    
    it("Should initialize with correct bet limits", async function () {
      const [minBet, maxBet] = await flipen.getBetLimits();
      expect(minBet).to.equal(MIN_BET);
      expect(maxBet).to.equal(MAX_BET);
    });
    
    it("Should return correct version", async function () {
      expect(await flipen.version()).to.equal("4.0.0");
    });
  });
  
  describe("CELO Game Logic", function () {
    it("Should allow valid coin flip with native CELO", async function () {
      const betAmount = ethers.parseEther("1");
      const choice = 1; // heads
      const seed = 12345;
      
      await expect(flipen.connect(player1).flipCoin(choice, ethers.ZeroAddress, { value: betAmount }))
        .to.emit(flipen, "GameRequested")
        .withArgs(1, player1.address, betAmount, choice, anyValue, ethers.ZeroAddress);
    });
    
    it("Should handle winning CELO game", async function () {
      const betAmount = ethers.parseEther("1");
      const choice = 1; // heads
      const winningSeed = 1; // 1 % 2 = 1 (heads)
      
      const initialBalance = await ethers.provider.getBalance(player1.address);
      
      const tx = await flipen.connect(player1).flipCoin(choice, ethers.ZeroAddress, { value: betAmount });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(player1.address);
      const expectedPayout = (betAmount * BigInt(PAYOUT_PERCENTAGE)) / BigInt(10000);
      
      expect(finalBalance).to.equal(initialBalance - betAmount - gasUsed + expectedPayout);
      
      const gameDetails = await flipen.getGameDetails(1);
      expect(gameDetails.won).to.be.true;
    });

    it("Should handle losing CELO game", async function () {
      const betAmount = ethers.parseEther("1");
      const choice = 1; // heads
      const losingSeed = 0; // 0 % 2 = 0 (tails)
      
      const initialBalance = await ethers.provider.getBalance(player1.address);
      
      const tx = await flipen.connect(player1).flipCoin(choice, ethers.ZeroAddress, { value: betAmount });
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(player1.address);
      
      expect(finalBalance).to.equal(initialBalance - betAmount - gasUsed);
      
      const gameDetails = await flipen.getGameDetails(1);
      expect(gameDetails.won).to.be.false;
    });
  });

  describe("cUSD Game Logic", function () {
    beforeEach(async function () {
      // Give player some cUSD and approve contract
      await mockCUSD.mint(player1.address, ethers.parseUnits("100", 18));
      await mockCUSD.connect(player1).approve(await flipen.getAddress(), ethers.parseUnits("100", 18));
    });

    it("Should allow valid coin flip with cUSD", async function () {
      const betAmount = ethers.parseUnits("10", 18);
      const choice = 0; // tails
      const seed = 123456;
      
      await expect(flipen.connect(player1).flipCoinERC20(choice, betAmount, await mockCUSD.getAddress(), ethers.ZeroAddress))
        .to.emit(flipen, "GameRequested");
    });

    it("Should handle winning cUSD game", async function () {
      const betAmount = ethers.parseUnits("10", 18);
      const choice = 0; // tails
      const winningSeed = 2; // 2 % 2 = 0 (tails)
      
      const initialBalance = await mockCUSD.balanceOf(player1.address);
      await flipen.connect(player1).flipCoinERC20(choice, betAmount, await mockCUSD.getAddress(), ethers.ZeroAddress);
      const finalBalance = await mockCUSD.balanceOf(player1.address);
      
      const expectedPayout = (betAmount * BigInt(PAYOUT_PERCENTAGE)) / BigInt(10000);
      expect(finalBalance).to.equal(initialBalance - betAmount + expectedPayout);
    });
  });
  
  describe("Admin Functions", function () {
    it("Should allow owner to withdraw CELO", async function () {
      const withdrawAmount = ethers.parseEther("10");
      const initialBalance = await ethers.provider.getBalance(owner.address);
      
      const tx = await flipen.connect(owner).withdrawCELO(withdrawAmount);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      
      const finalBalance = await ethers.provider.getBalance(owner.address);
      expect(finalBalance).to.equal(initialBalance + withdrawAmount - gasUsed);
    });

    it("Should allow owner to withdraw cUSD", async function () {
      const withdrawAmount = ethers.parseUnits("50", 18);
      const initialBalance = await mockCUSD.balanceOf(owner.address);
      
      await flipen.connect(owner).withdrawToken(await mockCUSD.getAddress(), withdrawAmount);
      
      const finalBalance = await mockCUSD.balanceOf(owner.address);
      expect(finalBalance).to.equal(initialBalance + withdrawAmount);
    });
  });
});

// Helper for anyValue matcher
const anyValue = (val: any) => true;
