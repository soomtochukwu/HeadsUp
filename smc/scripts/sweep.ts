import { ethers } from "hardhat";
import { formatUnits, parseUnits } from "ethers";

const PROXY_ADDRESS = "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb";

const TOKEN_ADDRESSES = {
    "USDm": "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    "cUSD": "0x765DE816845861e75A25fCA122bb6898B8B1282a",
    "USDC": "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
    "USDT": "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e",
};

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

async function main() {
    console.log("=== SWEEPING ALL ASSETS TO ADMIN ===");
    
    const [admin] = await ethers.getSigners();
    console.log(`Admin Address: ${admin.address}`);
    
    const Flipen = await ethers.getContractFactory("Flipen");
    const contract = Flipen.attach(PROXY_ADDRESS) as any;

    console.log("\n[1] Sweeping CELO...");
    
    // Step 1: Force cancel all pending CELO games to free up locked funds
    console.log("Canceling pending CELO games...");
    let tx = await contract.withdrawCELO(0, true, 500, { gasLimit: 4000000 });
    await tx.wait();
    console.log("Pending CELO games cancelled.");

    // Step 2: Check available CELO
    const contractCeloBalance = await ethers.provider.getBalance(PROXY_ADDRESS);
    const lockedCelo = await contract.lockedFundsToken(ethers.ZeroAddress);
    const availableCelo = contractCeloBalance > lockedCelo ? contractCeloBalance - lockedCelo : 0n;

    console.log(`Contract CELO Balance: ${formatUnits(contractCeloBalance, 18)}`);
    console.log(`Locked CELO: ${formatUnits(lockedCelo, 18)}`);
    console.log(`Available to sweep: ${formatUnits(availableCelo, 18)}`);

    if (availableCelo > 0n) {
        const oneCelo = parseUnits("1", 18);
        let sweepAmount = availableCelo;
        if (contractCeloBalance - sweepAmount < oneCelo) {
            sweepAmount = contractCeloBalance > oneCelo ? contractCeloBalance - oneCelo : 0n;
        }

        if (sweepAmount > 0n) {
            console.log(`Sweeping ${formatUnits(sweepAmount, 18)} CELO to admin...`);
            tx = await contract.withdrawCELO(sweepAmount, false, 0);
            await tx.wait();
            console.log("CELO successfully swept.");
        } else {
            console.log("Cannot sweep CELO without breaking 1 CELO minimum balance.");
        }
    } else {
        console.log("No CELO available to sweep.");
    }

    // Array of unique token addresses
    const uniqueTokens = Array.from(new Set(Object.values(TOKEN_ADDRESSES)));

    console.log("\n[2] Sweeping ERC20 Tokens...");
    for (const tokenAddr of uniqueTokens) {
        const tokenContract = new ethers.Contract(tokenAddr, ERC20_ABI, admin);
        const decimals = await tokenContract.decimals();
        
        console.log(`\nProcessing Token: ${tokenAddr} (Decimals: ${decimals})`);
        
        // Step 1: Force cancel all pending token games
        console.log("Canceling pending games for token...");
        tx = await contract.withdrawToken(tokenAddr, 0, true, 500, { gasLimit: 4000000 });
        await tx.wait();
        
        // Step 2: Check available token
        const contractTokenBalance = await tokenContract.balanceOf(PROXY_ADDRESS);
        const lockedToken = await contract.lockedFundsToken(tokenAddr);
        const availableToken = contractTokenBalance > lockedToken ? contractTokenBalance - lockedToken : 0n;

        console.log(`Contract Token Balance: ${formatUnits(contractTokenBalance, decimals)}`);
        console.log(`Locked Token: ${formatUnits(lockedToken, decimals)}`);
        console.log(`Available to sweep: ${formatUnits(availableToken, decimals)}`);

        if (availableToken > 0n) {
            console.log(`Sweeping ${formatUnits(availableToken, decimals)} tokens to admin...`);
            tx = await contract.withdrawToken(tokenAddr, availableToken, false, 0);
            await tx.wait();
            console.log("Token successfully swept.");
        } else {
            console.log("No token balance available to sweep.");
        }
    }
    
    console.log("\n=== SWEEP COMPLETED SUCCESSFULLY ===");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
