import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../smc/.env") });

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)"
];

async function main() {
  console.log(`
  ▄▄▄█████▓ ▒█████   ██▓     ██▓    
  ▓  ██▒ ▓▒▒██▒  ██▒▓██▒    ▓██▒    
  ▒ ▓██░ ▒░▒██░  ██▒▒██░    ▒██░    
  ░ ▓██▓ ░ ▒██   ██░▒██░    ▒██░    
    ▒██▒ ░ ░ ████▓▒░░██████▒░██████▒
    ▒ ░░   ░ ▒░▒░▒░ ░ ▒░▓  ░░ ▒░▓  ░
      ░      ░ ▒ ▒░ ░ ░ ▒  ░░ ░ ▒  ░
    ░      ░ ░ ░ ▒    ░ ░     ░ ░   
               ░ ░      ░  ░    ░  ░
  [+] High-Performance Concurrent Play Matrix Initialized...
  `);

  const addressesPath = path.join(__dirname, "../smc/addresses/celo-addresses.json");
  const addresses = JSON.parse(fs.readFileSync(addressesPath, "utf8"));
  const proxyAddress = addresses.proxyAddress;

  if (!proxyAddress) {
    console.error("[-] Proxy address missing.");
    process.exit(1);
  }

  const abiPath = path.join(__dirname, "../FE/contracts/celo-abi.json");
  const abi = JSON.parse(fs.readFileSync(abiPath, "utf8"));

  const signers = await ethers.getSigners();
  console.log(`[+] Mounted ${signers.length} asynchronous attack vectors (threads).`);

  if (signers.length === 0) {
    console.error("[-] Null configuration. Insert keys in .env");
    process.exit(1);
  }

  const ASSETS = [
    { symbol: "CELO", address: ethers.ZeroAddress, decimals: 18, amountRaw: "0.1" },
    { symbol: "USDC", address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6, amountRaw: "1.0" },
    { symbol: "USDT", address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6, amountRaw: "1.0" },
    { symbol: "USDm", address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, amountRaw: "1.0" }
  ];

  console.log("[*] Executing Pre-Flight Max-Approvals...");
  // Pre-approve max tokens across all signers to eliminate overhead in the hot loop
  const approvalPromises = [];
  for (const signer of signers) {
    for (const asset of ASSETS) {
      if (asset.address !== ethers.ZeroAddress) {
        const token = new ethers.Contract(asset.address, ERC20_ABI, signer);
        approvalPromises.push((async () => {
          try {
            const allowance = await token.allowance(signer.address, proxyAddress);
            if (allowance < ethers.parseUnits("1000", asset.decimals)) {
              const tx = await token.approve(proxyAddress, ethers.MaxUint256);
              await tx.wait();
            }
          } catch (e) {
            // Silently absorb
          }
        })());
      }
    }
  }
  await Promise.all(approvalPromises);
  console.log(`[+] Approvals secured. Engaging concurrent hot loops...\n`);

  let isShuttingDown = false;
  
  // Cleanup function to reset approvals
  const cleanup = async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log("\n[!] Shutdown signal received. Revoking approvals (Resetting to 0)...");
    
    const revokePromises = [];
    for (const signer of signers) {
      for (const asset of ASSETS) {
        if (asset.address !== ethers.ZeroAddress) {
          const token = new ethers.Contract(asset.address, ERC20_ABI, signer);
          revokePromises.push((async () => {
            try {
              const tx = await token.approve(proxyAddress, 0);
              await tx.wait();
              console.log(`[+] Revoked ${asset.symbol} approval for ${signer.address.substring(0, 6)}...`);
            } catch (e) {
               console.log(`[-] Failed to revoke ${asset.symbol} approval for ${signer.address.substring(0, 6)}...`);
            }
          })());
        }
      }
    }
    
    await Promise.all(revokePromises);
    console.log("[+] All approvals successfully reset to 0. Exiting.");
    process.exit(0);
  };

  // Bind graceful termination handlers
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  const admin = signers[0];
  const players = signers.slice(1);
  const adminFlipen = new ethers.Contract(proxyAddress, abi, admin);

  console.log(`[+] Admin Account: ${admin.address}`);
  console.log(`[+] Player Accounts: ${players.length}`);

  // Admin Thread: Smart Faucet
  const adminPromise = (async () => {
    while (!isShuttingDown) {
      try {
        for (const asset of ASSETS) {
          try {
            const betAmount = ethers.parseUnits(asset.amountRaw, asset.decimals);
            const topUpTarget = betAmount * 10n; // Target top-up for players (10 bets)
            const minBalance = betAmount * 2n; // If below 2 bets, top them up

            // 1. Check which players need funds
            const playersToFund = [];
            for (const player of players) {
               let bal;
               if (asset.address === ethers.ZeroAddress) {
                 bal = await ethers.provider.getBalance(player.address);
               } else {
                 const token = new ethers.Contract(asset.address, ERC20_ABI, admin);
                 bal = await token.balanceOf(player.address);
               }
               if (bal < minBalance) {
                 playersToFund.push(player);
               }
            }

            if (playersToFund.length === 0) continue;

            const totalNeeded = topUpTarget * BigInt(playersToFund.length);

            // 2. Ensure Admin has enough funds
            let adminBal: bigint;
            if (asset.address === ethers.ZeroAddress) {
               adminBal = BigInt(await ethers.provider.getBalance(admin.address));
            } else {
               const token = new ethers.Contract(asset.address, ERC20_ABI, admin);
               adminBal = BigInt(await token.balanceOf(admin.address));
            }

            // Keep 1 CELO buffer for admin gas
            const adminBuffer = asset.address === ethers.ZeroAddress ? ethers.parseEther("1.0") : 0n;
            const adminAvailable: bigint = adminBal > adminBuffer ? adminBal - adminBuffer : 0n;

            if (adminAvailable < totalNeeded) {
               // Admin needs to withdraw from contract
               const shortfall = totalNeeded - adminAvailable;
               // Withdraw shortfall + buffer so we don't hit the contract every time
               const withdrawAmount = shortfall + (topUpTarget * 10n);
               
               // Check if contract has enough
               let contractAvailable: bigint = 0n;
               const locked = BigInt(await adminFlipen.lockedFundsToken(asset.address));
               if (asset.address === ethers.ZeroAddress) {
                 const cBal = BigInt(await ethers.provider.getBalance(proxyAddress));
                 contractAvailable = cBal > locked ? cBal - locked : 0n;
               } else {
                 const token = new ethers.Contract(asset.address, ERC20_ABI, admin);
                 const cBal = BigInt(await token.balanceOf(proxyAddress));
                 contractAvailable = cBal > locked ? cBal - locked : 0n;
               }

               // Don't drain contract completely, ensure at least 20x betAmount is left for payouts
               const minContractBuffer = betAmount * 20n;
               let safeWithdraw: bigint = contractAvailable > minContractBuffer ? contractAvailable - minContractBuffer : 0n;

               if (safeWithdraw > 0n) {
                 const actualWithdraw = safeWithdraw > withdrawAmount ? withdrawAmount : safeWithdraw;
                 console.log(`[Admin] Withdrawing ${ethers.formatUnits(actualWithdraw, asset.decimals)} ${asset.symbol} from contract to replenish faucet...`);
                 if (asset.address === ethers.ZeroAddress) {
                   const tx = await adminFlipen.withdrawCELO(actualWithdraw, { gasLimit: 300000 });
                   await tx.wait(1);
                 } else {
                   const tx = await adminFlipen.withdrawToken(asset.address, actualWithdraw, { gasLimit: 300000 });
                   await tx.wait(1);
                 }
                 
                 // Update adminBal after withdrawal
                 if (asset.address === ethers.ZeroAddress) {
                   adminBal = BigInt(await ethers.provider.getBalance(admin.address));
                 } else {
                   const token = new ethers.Contract(asset.address, ERC20_ABI, admin);
                   adminBal = BigInt(await token.balanceOf(admin.address));
                 }
               } else {
                 console.log(`[Admin] Contract ${asset.symbol} bankroll too low to withdraw. Skipping top-ups.`);
                 continue; // Can't fund right now
               }
            }

            // 3. Distribute to players who need it
            let currentAdminAvailable: bigint = adminBal > adminBuffer ? adminBal - adminBuffer : 0n;
            for (const player of playersToFund) {
               if (currentAdminAvailable < topUpTarget) break; // ran out of admin funds
               
               console.log(`[Admin] Sending ${ethers.formatUnits(topUpTarget, asset.decimals)} ${asset.symbol} to top-up ${player.address.substring(0,6)}...`);
               if (asset.address === ethers.ZeroAddress) {
                 const tx = await admin.sendTransaction({ to: player.address, value: topUpTarget });
                 await tx.wait(1);
               } else {
                 const token = new ethers.Contract(asset.address, ERC20_ABI, admin);
                 const tx = await token.transfer(player.address, topUpTarget);
                 await tx.wait(1);
               }
               currentAdminAvailable -= topUpTarget;
            }

          } catch (e: any) {
             console.log(`[Admin] Error managing ${asset.symbol}: ${e.shortMessage || e.message}`);
          }
        }
      } catch (e) {
        // absorb
      }
      // Check balances every 15 seconds
      await sleep(15000);
    }
  })();

  // Spin up an independent asynchronous thread per signer (including admin)
  const workerPromises = signers.map(async (signer: any, idx: number) => {
    const flipen = new ethers.Contract(proxyAddress, abi, signer);
    const id = `T${idx}-${signer.address.substring(0, 6)}`;

    while (!isShuttingDown) {
      try {
        const asset = ASSETS[Math.floor(Math.random() * ASSETS.length)];
        const betAmount = ethers.parseUnits(asset.amountRaw, asset.decimals);
        const choice = Math.random() > 0.5 ? 1 : 0;
        
        // 1. COMMIT
        let flipTx;
        if (asset.address === ethers.ZeroAddress) {
          flipTx = await flipen.flipCoin(choice, ethers.ZeroAddress, { value: betAmount, gasLimit: 500000 });
        } else {
          flipTx = await flipen.flipCoinERC20(choice, betAmount, asset.address, ethers.ZeroAddress, { gasLimit: 600000 });
        }

        const receipt = await flipTx.wait(1);
        
        const gameRequestedEvent = receipt?.logs
          .map((log: any) => {
            try { return flipen.interface.parseLog(log); } catch (e) { return null; }
          })
          .find((event: any) => event?.name === "GameRequested");

        if (gameRequestedEvent) {
          const requestId = gameRequestedEvent.args.requestId;
          
          // Small buffer to guarantee sequencer synchronization
          await sleep(2000); 
          
          // 2. RESOLVE
          const resolveTx = await flipen.resolveGame(requestId, { gasLimit: 500000 });
          const resReceipt = await resolveTx.wait(1);
          
          const gameResultEvent = resReceipt?.logs
            .map((log: any) => {
              try { return flipen.interface.parseLog(log); } catch (e) { return null; }
            })
            .find((event: any) => event?.name === "GameResult");

          if (gameResultEvent) {
             const { won } = gameResultEvent.args;
             const marker = won ? "\x1b[32m[WIN!]\x1b[0m" : "\x1b[31m[LOSS]\x1b[0m";
             console.log(`[${id}] ${asset.symbol.padEnd(4)} | ${marker}`);
          }
        }
      } catch (e: any) {
         // Quietly catch errors like insufficient funds to maintain thread speed
         const msg = e?.shortMessage || e?.message || "";
         if (!msg.includes("insufficient funds") && !msg.includes("transfer amount exceeds balance")) {
            console.log(`\x1b[33m[${id}] ERR\x1b[0m: ${msg.substring(0, 40)}...`);
         }
      }
      
      // Minimal delay between cycles to avoid rate limiting and allow block finality
      await sleep(1500 + Math.random() * 3000);
    }
  });

  await Promise.all([...workerPromises, adminPromise]);
}

main().catch(console.error);
