import { ethers } from "hardhat";
import { Contract } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

interface GameRequest {
  player: string;
  amount: bigint;
  playerChoice: number;
  fulfilled: boolean;
  won: boolean;
  timestamp: bigint;
}

interface ContractStats {
  totalGames: bigint;
  volume: bigint;
  balance: bigint;
  fees: bigint;
}

async function main(): Promise<void> {
  const PROXY_ADDRESS: string = process.env.PROXY_ADDRESS || "YOUR_PROXY_ADDRESS_HERE";
  
  if (PROXY_ADDRESS === "YOUR_PROXY_ADDRESS_HERE") {
    throw new Error("Please set PROXY_ADDRESS environment variable");
  }
  
  const [signer]: HardhatEthersSigner[] = await ethers.getSigners();
  const flipen: Contract = await ethers.getContractAt("Flipen", PROXY_ADDRESS, signer);
  
  console.log("Interacting with Flipen contract at:", PROXY_ADDRESS);
  console.log("Using account:", signer.address);
  
  try {
    // Get contract stats
    const stats: ContractStats = await flipen.getContractStats();
    console.log("\nContract Statistics:");
    console.log("Total Games:", stats.totalGames.toString());
    console.log("Total Volume:", ethers.formatEther(stats.volume), "CELO");
    console.log("Contract Balance:", ethers.formatEther(stats.balance), "CELO");
    console.log("Platform Fees:", ethers.formatEther(stats.fees), "CELO");
    
    // Get bet limits
    const [minBet, maxBet] = await flipen.getBetLimits();
    console.log("\nBet Limits:");
    console.log("Minimum Bet:", ethers.formatEther(minBet), "CELO");
    console.log("Maximum Bet:", ethers.formatEther(maxBet), "CELO");
    
    // Get VRF settings
    const [subscriptionId, keyHash, callbackGasLimit, requestConfirmations] = await flipen.getVRFSettings();
    console.log("\nVRF Settings:");
    console.log("Subscription ID:", subscriptionId.toString());
    console.log("Key Hash:", keyHash);
    console.log("Callback Gas Limit:", callbackGasLimit.toString());
    console.log("Request Confirmations:", requestConfirmations.toString());
    
    // Example: Play a game (uncomment to test)
    /*
    console.log("\nPlaying a game...");
    const betAmount = ethers.parseEther("0.1"); // 0.1 CELO
    const choice = 1; // 1 for heads, 0 for tails
    
    const tx = await flipen.flipCoin(choice, { value: betAmount });
    console.log("Transaction hash:", tx.hash);
    
    const receipt = await tx.wait();
    console.log("Game request submitted in block:", receipt.blockNumber);
    */
    
  } catch (error) {
    console.error("Error interacting with contract:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });