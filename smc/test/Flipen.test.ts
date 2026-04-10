import { expect } from "chai";
import { ethers, upgrades, network } from "hardhat";
import { Flipen, MockERC20 } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("Flipen Smart Contract", function () {
  let flipen: Flipen;
  let mockCUSD: MockERC20;
  let owner: SignerWithAddress;
  let player1: SignerWithAddress;
  let player2: SignerWithAddress;
  
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
      value: ethers.parseEther("10")
    });
    
    // Fund the contract for payouts (cUSD)
    await mockCUSD.mint(await flipen.getAddress(), ethers.parseUnits("100", 18));
  });
  
  describe("Deployment and Initialization", function () {
    it("Should set the right owner", async function () {
      expect(await flipen.owner()).to.equal(owner.address);
    });
    
    it("Should return correct version", async function () {
      expect(await flipen.version()).to.equal("6.0.0 (Native Entropy)");
    });
  });

  describe("Core Game Logic (CELO & cUSD)", function () {
    it("Should allow valid coin flip with native CELO and resolve it", async function () {
      const betAmount = ethers.parseEther("1");
      const choice = 1; 
      
      const tx = await flipen.connect(player1).flipCoin(choice, ethers.ZeroAddress, { value: betAmount });
      await tx.wait();

      await network.provider.send("evm_mine", []);

      await flipen.resolveGame(1);
      const details = await flipen.getGameDetails(1);
      expect(details.status).to.equal(1); // FULFILLED
    });

    it("Should allow valid coin flip with cUSD and resolve it", async function () {
      const betAmount = ethers.parseUnits("10", 18);
      const choice = 0; 

      await mockCUSD.mint(player1.address, ethers.parseUnits("100", 18));
      await mockCUSD.connect(player1).approve(await flipen.getAddress(), ethers.parseUnits("100", 18));
      
      await flipen.connect(player1).flipCoinERC20(choice, betAmount, await mockCUSD.getAddress(), ethers.ZeroAddress);
      
      await network.provider.send("evm_mine", []);

      await flipen.resolveGame(1);
      const details = await flipen.getGameDetails(1);
      expect(details.status).to.equal(1); // FULFILLED
    });
  });

  describe("V2 Referral System", function () {
    it("Should accrue 1% referral reward and allow claim", async function () {
      const betAmount = ethers.parseEther("1");
      
      // Player 2 is referred by Player 1
      await flipen.connect(player2).flipCoin(1, player1.address, { value: betAmount });
      await network.provider.send("evm_mine", []);
      await flipen.resolveGame(1);

      // Check earnings
      const earnings = await flipen.referralEarningsCELO(player1.address);
      const expectedEarnings = (betAmount * 100n) / 10000n; // 1%
      expect(earnings).to.equal(expectedEarnings);

      // Claim
      const initialBal = await ethers.provider.getBalance(player1.address);
      const tx = await flipen.connect(player1).claimReferralRewards();
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const finalBal = await ethers.provider.getBalance(player1.address);

      expect(finalBal).to.equal(initialBal - gasUsed + expectedEarnings);
      expect(await flipen.referralEarningsCELO(player1.address)).to.equal(0);
    });
  });

  describe("V3 Onboarding Bonus", function () {
    it("Should allow admin to update onboarding bonus", async function () {
      const celoBonus = ethers.parseEther("0.5");
      const cusdBonus = ethers.parseUnits("1", 18);
      await flipen.connect(owner).updateOnboardingBonus(celoBonus, cusdBonus);

      expect(await flipen.onboardingBonusCELO()).to.equal(celoBonus);
      expect(await flipen.onboardingBonusCUSD()).to.equal(cusdBonus);
    });

    it("Should allow valid claim of onboarding bonus", async function () {
      const celoBonus = ethers.parseEther("0.5");
      const cusdBonus = ethers.parseUnits("1", 18);
      await flipen.connect(owner).updateOnboardingBonus(celoBonus, cusdBonus);

      // Player 1 needs to play a game
      await flipen.connect(player1).flipCoin(1, ethers.ZeroAddress, { value: ethers.parseEther("0.1") });
      await network.provider.send("evm_mine", []);
      await flipen.resolveGame(1);

      // Player 1 needs to refer Player 2
      await flipen.connect(player2).flipCoin(1, player1.address, { value: ethers.parseEther("0.1") });
      await network.provider.send("evm_mine", []);
      await flipen.resolveGame(2);

      // Now Player 1 claims CELO bonus
      const initialBal = await ethers.provider.getBalance(player1.address);
      const tx = await flipen.connect(player1).claimOnboardingBonus(ethers.ZeroAddress);
      const receipt = await tx.wait();
      const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
      const finalBal = await ethers.provider.getBalance(player1.address);

      expect(finalBal).to.equal(initialBal - gasUsed + celoBonus);
      expect(await flipen.hasClaimedOnboardingBonus(player1.address)).to.be.true;
    });

    it("Should revert if claiming without playing or referring", async function () {
      const celoBonus = ethers.parseEther("0.5");
      await flipen.connect(owner).updateOnboardingBonus(celoBonus, 0);

      await expect(flipen.connect(player1).claimOnboardingBonus(ethers.ZeroAddress)).to.be.revertedWith("Must play at least once");
      
      // Play a game
      await flipen.connect(player1).flipCoin(1, ethers.ZeroAddress, { value: ethers.parseEther("0.1") });
      await expect(flipen.connect(player1).claimOnboardingBonus(ethers.ZeroAddress)).to.be.revertedWith("Must refer at least one friend");
    });
  });
});