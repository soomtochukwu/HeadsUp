import { ethers } from "hardhat";

async function main() {
    const PROXY_ADDRESS = "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb";
    const Flipen = await ethers.getContractFactory("Flipen");
    const contract = Flipen.attach(PROXY_ADDRESS) as any;
    
    const stats = await contract["getContractStats(address)"](ethers.ZeroAddress);
    const totalGames = Number(stats.totalGames);
    console.log(`Total games to scan: ${totalGames}`);
    
    for (let i = 1; i <= totalGames; i++) {
        try {
            const game = await contract.getGameDetails(i);
            // game.status: 0=PENDING, 1=FULFILLED, 2=CANCELLED, 3=EXPIRED
            if (Number(game.status) === 0) {
                console.log(`Game ${i} is PENDING. Attempting to resolve/expire...`);
                const tx = await contract.resolveGame(i, { gasLimit: 500000 });
                await tx.wait();
                console.log(`Game ${i} liberated!`);
            }
        } catch (e: any) {
            console.log(`Failed to process game ${i}: ${e.shortMessage || e.message}`);
        }
    }
    console.log("Liberation complete!");
}
main();
