import { PublicClient, decodeEventLog } from 'viem'
import SEPOLIA_ABI from '@/contracts/sepolia-abi.json'
import MAINNET_ABI from '@/contracts/celo-abi.json'

// Optimized Birth Blocks (Set to 0 to be absolutely sure we get everything)
const BIRTH_BLOCKS: Record<number, bigint> = {
  11142220: BigInt(0), // Sepolia
  42220: BigInt(0),    // Mainnet
}

const CHUNK_SIZE = BigInt(50000) // Increase chunk size for faster recovery

export interface ParsedGameEvent {
  requestId: bigint
  player: `0x${string}`
  amount: bigint
  playerChoice: number
  result: number
  won: boolean
  payout: bigint
  timestamp: bigint
  txHash: string
  blockNumber: bigint
}

/**
 * Recovers all historical game events from the blockchain
 */
export async function recoverAllHistory(
  publicClient: PublicClient,
  proxyAddress: `0x${string}`,
  chainId: number
): Promise<ParsedGameEvent[]> {
  const birthBlock = BIRTH_BLOCKS[chainId] || BigInt(0)
  const currentBlock = await publicClient.getBlockNumber()
  const contractABI = chainId === 42220 ? MAINNET_ABI : SEPOLIA_ABI
  
  console.log(`[DEEP SCAN] Starting recovery for ${proxyAddress} on chain ${chainId}`);
  console.log(`[DEEP SCAN] Current Block: ${currentBlock}, Scanning back to: ${birthBlock}`);

  let allEvents: ParsedGameEvent[] = []
  let toBlock: bigint = currentBlock
  let fromBlock: bigint = toBlock - CHUNK_SIZE

  // Avoid scanning millions of empty blocks if possible
  // For Celo, the proxies are very recent, so we can stop if we find the creation block or a long streak of empty chunks
  let emptyChunkCount = 0
  const MAX_EMPTY_CHUNKS = 10 

  while (toBlock > birthBlock) {
    if (fromBlock < birthBlock) fromBlock = birthBlock

    try {
      const logs = await publicClient.getLogs({
        address: proxyAddress,
        event: {
          "type": "event",
          "name": "GameResult",
          "inputs": [
            { "type": "uint256", "name": "requestId", "indexed": true },
            { "type": "address", "name": "player", "indexed": true },
            { "type": "uint256", "name": "amount", "indexed": false },
            { "type": "uint8", "name": "playerChoice", "indexed": false },
            { "type": "uint8", "name": "result", "indexed": false },
            { "type": "bool", "name": "won", "indexed": false },
            { "type": "uint256", "name": "payout", "indexed": false },
            { "type": "uint256", "name": "randomNumber", "indexed": false },
            { "type": "uint256", "name": "timestamp", "indexed": false },
            { "type": "address", "name": "token", "indexed": false }
          ]
        },
        fromBlock,
        toBlock
      })

      if (logs.length > 0) {
        emptyChunkCount = 0
        const parsed = logs.map(log => {
          try {
            const decoded = decodeEventLog({
              abi: contractABI as any,
              data: log.data,
              topics: log.topics,
            }) as any
            return {
              ...decoded.args,
              txHash: log.transactionHash,
              blockNumber: log.blockNumber
            }
          } catch (e) {
            return null
          }
        }).filter(e => e !== null) as ParsedGameEvent[]

        allEvents = [...allEvents, ...parsed]
        console.log(`[DEEP SCAN] Found ${logs.length} events in range ${fromBlock}-${toBlock}`);
      } else {
        emptyChunkCount++
      }

      // If we've scanned back 500,000 blocks and found nothing, stop (safety)
      if (emptyChunkCount >= MAX_EMPTY_CHUNKS && allEvents.length > 0) {
        console.log(`[DEEP SCAN] Reached end of relevant history.`);
        break
      }

      if (fromBlock === birthBlock) break

      toBlock = fromBlock - BigInt(1)
      fromBlock = toBlock - CHUNK_SIZE
    } catch (error) {
      console.error(`[DEEP SCAN] Error in range ${fromBlock}-${toBlock}:`, error)
      break 
    }
  }

  const uniqueEvents = Array.from(new Map(allEvents.map(e => [e.requestId.toString(), e])).values());
  return uniqueEvents.sort((a, b) => Number(b.blockNumber - a.blockNumber))
}
