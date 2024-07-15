import { ethers } from 'ethers'
import type { TChainWallet, TChainsWithWalletsLink } from './types'

export const WALLET_NAMES = /* #__PURE__ */ {
  WalletConnect: 'WalletConnect',
  MetaMask: 'MetaMask',
  xDefi: 'xDefi',
  Phantom: 'Phantom',
  Near: 'Near',
  Coinbase: 'Coinbase',
  Keplr: 'Keplr',
  Safe: 'Safe'
} as const

export const WALLET_SUBNAME = /* #__PURE__ */ {
  Safe: 'Safe'
} as const

export const NETWORK_IDS = /* #__PURE__ */ {
  Ethereum: 1,
  Rinkeby: 4,
  Optimism: 10,
  OptimismTestnet: 69,
  Binance: 56,
  BinanceTestnet: 97,
  Polygon: 137,
  PolygonTestnet: 80001,
  Arbitrum: 42161,
  ArbitrumTestnet: 421611,
  Fantom: 250,
  Astar: 592,
  FantomTestnet: 4002,
  Avalanche: 43114,
  AvalancheTestnet: 43113,
  Harmony: 1666600000,
  HarmonyTestnet: 1666700000,
  Heco: 128,
  HecoTestnet: 256,
  Okex: 66,
  OkexTestnet: 65,
  Candle: 534,
  Gnosis: 100,
  KuCoin: 321,
  Moonbeam: 1284,
  Moonriver: 1285,
  MoonriverTestnet: 1287,
  Fuse: 122,
  Cube: 1818,
  Aurora: 1313161554,
  Cronos: 25,
  Boba: 288,
  Celo: 42220,
  ZkSync: 324,
  Solana: -1,
  SolanaTestnet: -1001,
  TON: -3,
  Base: 8453,
  Mantle: 5000,
  zkEVM: 1101,
  Linea: 59144,
  Cosmos: -100,
  Osmosis: -101,
  Sifchain: -102,
  TONTestnet: -1003,
  BTC: -200,
  Litecoin: -201,
  BCH: -202,
  Base: 8453,
  Tron: -10
} as const

export const EVM_BASE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'
export const SOLANA_BASE_TOKEN_ADDRESS = 'So11111111111111111111111111111111111111111'

export const EVM_ENS_POSTFIX = '.eth'
export const SOLANA_ENS_POSTFIX = '.sol'

export const EVM_NON_CONTRACT_ADDRESS_CODE = '0x'

export const BTC_WALLETS_CONFIG = [WALLET_NAMES.xDefi]
export const EVM_WALLETS_CONFIG = [
  WALLET_NAMES.MetaMask,
  WALLET_NAMES.WalletConnect,
  WALLET_NAMES.Coinbase,
  WALLET_NAMES.xDefi,
  WALLET_NAMES.Safe
]
export const SOL_WALLETS_CONFIG = [WALLET_NAMES.Phantom]
export const COSMOS_WALLETS_CONFIG = [WALLET_NAMES.Keplr]

export const BTC_CHAINS = [NETWORK_IDS.BTC, NETWORK_IDS.Litecoin, NETWORK_IDS.BCH]
export const EVM_CHAINS = /* #__PURE__ */ Object.keys(NETWORK_IDS).filter(chainName => NETWORK_IDS[chainName as keyof typeof NETWORK_IDS] > 0).map(chainName => NETWORK_IDS[chainName as keyof typeof NETWORK_IDS])
export const SOL_CHAINS = [NETWORK_IDS.Solana, NETWORK_IDS.SolanaTestnet]
export const COSMOS_CHAINS = [NETWORK_IDS.Cosmos, NETWORK_IDS.Osmosis, NETWORK_IDS.Sifchain] as const

export const isEvmChain = (chainId: number) => chainId > 0
export const isCosmosChain = (chainId: number) => COSMOS_CHAINS.includes(chainId as any)
export const isSolChain = (chainId: number) => SOL_CHAINS.includes(chainId as any)
export const isBTClikeChain = (chainId: number) => BTC_CHAINS.includes(chainId as any)

export const AVAILABLE_WALLETS_GROUPS_CONFIG = ['EVM', 'SOL', 'COSMOS', 'BTC', 'LTC', 'BCH'] as const

export const chainWalletMap: TChainWallet[] = [
  { name: 'COSMOS', chainId: NETWORK_IDS.Cosmos, network: 'cosmoshub-4' },
  { name: 'OSMOSIS', chainId: NETWORK_IDS.Osmosis, network: 'osmosis-1' },
  { name: 'SIF', chainId: NETWORK_IDS.Sifchain, network: 'sifchain-1' },
  { name: 'BTC', chainId: NETWORK_IDS.BTC, network: 'bitcoin' },
  { name: 'LTC', chainId: NETWORK_IDS.Litecoin, network: 'litecoin' },
  { name: 'BCH', chainId: NETWORK_IDS.BCH, network: 'bitcoincash' }
]

export const cosmosChainWalletMap = /* #__PURE__ */ chainWalletMap.filter(chainWallet => COSMOS_CHAINS.includes(chainWallet.chainId as any))

export const btcChainWalletMap = /* #__PURE__ */ chainWalletMap.filter(chainWallet => BTC_CHAINS.includes(chainWallet.chainId as any))

export const CHAINS_WITH_WALLET: TChainsWithWalletsLink[] = /* #__PURE__ */ [
  {
    key: 'BTC',
    chains: BTC_CHAINS,
    wallets: BTC_WALLETS_CONFIG,
    validate: isBTClikeChain
  },
  {
    key: 'EVM',
    chains: EVM_CHAINS,
    wallets: EVM_WALLETS_CONFIG,
    validate: isEvmChain
  },
  {
    key: 'SOL',
    chains: SOL_CHAINS,
    wallets: SOL_WALLETS_CONFIG,
    validate: isSolChain
  },
  {
    key: 'COSMOS',
    chains: COSMOS_CHAINS,
    wallets: COSMOS_WALLETS_CONFIG,
    validate: isCosmosChain
  }
]

export const ERC20_GAS_LIMIT = 300000

export const LOCAL_STORAGE_WALLETS_KEY = 'web3-wallets-data'

export const LOCAL_STORAGE_WALLETS_ADDRESSES = 'web3-wallets-addresses'

export const ETHEREUM_RPC = 'https://rpc.ankr.com/eth'
export const ETHEREUM_PROVIDER = new ethers.providers.JsonRpcProvider(ETHEREUM_RPC)
