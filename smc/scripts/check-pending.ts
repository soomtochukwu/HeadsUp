import { ethers } from "hardhat";

const PROXY_ADDRESS = "0xD6c9912EB6fd064A6B8Bd5786C3cf787806EEdAb";

async function main() {
    const Flipen = await ethers.getContractFactory("Flipen");
    const contract = Flipen.attach(PROXY_ADDRESS) as any;

    const stats = await contract["getContractStats(address)"](ethers.ZeroAddress);
    const totalGames = Number(stats.totalGames);
    
    console.log(`Scanning ${totalGames} games for pending ERC20 games...`);
    
    let pendingGames = 0;
    for (let i = 0; i < totalGames; i++) {
        try {
            const game = await contract.getGameDetails(i);
            // status 0 is PENDING
            if (Number(game.status) === 0) {
                console.log(`Game ${i} is PENDING for token ${game.token}`);
                pendingGames++;
            }
        } catch (e: any) {
            console.log(`Failed to fetch game ${i}: ${e.shortMessage || e.message}`);
        }
    }
    console.log(`Found ${pendingGames} pending games.`);
}
main();
