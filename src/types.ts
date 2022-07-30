import type { CoinbaseWalletProvider } from '@coinbase/wallet-sdk'
import type { TransactionRequest, Web3Provider } from '@ethersproject/providers'
import type { Keplr } from '@keplr-wallet/types'
import type { MetaMaskInpageProvider } from '@metamask/providers'
import type { Connection, Signer, Transaction } from '@solana/web3.js'
import type WalletConnectProvider from '@walletconnect/web3-provider'
import type { BigNumber, ethers } from 'ethers'
import type { WALLET_NAMES } from './constants'
import type { COSMOS_WALLETS_CONFIG, EVM_WALLETS_CONFIG, SOL_WALLETS_CONFIG } from './hooks/useBalance/config'

type TAvailableWalletNames = keyof typeof WALLET_NAMES
type TAvailableEvmWalletNames = typeof EVM_WALLETS_CONFIG[number]
type TAvailableSolWalletNames = typeof SOL_WALLETS_CONFIG[number]
type TAvailableCosmosWalletNames = typeof COSMOS_WALLETS_CONFIG[number]

enum WalletStatusEnum {
  NOT_INITED = 'NOT_INITED',
  CONNECTING = 'CONNECTING',
  LOADING = 'LOADING',
  READY = 'READY'
}

type TEvmWallet = {
  name: TAvailableEvmWalletNames
  provider: Web3Provider | null
}

type TSolWallet = {
  name: TAvailableSolWalletNames
  provider: any
}

type TCosmosWallet = {
  name: TAvailableCosmosWalletNames
  provider: Keplr
}

type TWalletBody = TEvmWallet | TSolWallet | TCosmosWallet

type TWalletStoreState = {
  isConnected: boolean
  status: WalletStatusEnum
  subName: null | string
  walletProvider: WalletConnectProvider | MetaMaskInpageProvider | CoinbaseWalletProvider | null
  connection: Connection | null
  chainId: null | number
  address: string | null
  addressShort: string | null
  addressDomain: string | null
  balance: string | null
} & TWalletBody

type TWalletLocalData = {
  name: string
  chainId: number
  address: string
}

type TWallet = {
  restore: () => Promise<boolean>
  connect: ({ name, chainId }: { name: any; chainId: any }) => Promise<boolean>
  changeNetwork: (chainId: number) => Promise<boolean>
  sendTx: (
    transaction: TransactionRequest | Transaction,
    options?: { signers?: Signer[] }
  ) => Promise<string /* | false */> // todo: sendTx reject => false
  disconnect: () => void
  estimateGas: (data: TransactionRequest) => Promise<BigNumber | undefined>
  waitForTransaction: (transactionHash: string, confirmations?: number) => Promise<void>
  getTransaction: (transactionHash: string) => Promise<ethers.providers.TransactionReceipt>
} & TWalletStoreState

type TWalletValues = keyof typeof WALLET_NAMES

export type { TAvailableWalletNames, TWallet, TWalletStoreState, TWalletLocalData, TWalletValues }
export { WalletStatusEnum }
