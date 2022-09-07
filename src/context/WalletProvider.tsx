/* 🚧 NEED TO BE REFACTORED 🚧 */
/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-use-before-define */
/* eslint-disable prefer-const */

import type { ExternalProvider, TransactionRequest } from '@ethersproject/providers'
import type { Signer } from '@solana/web3.js'
import { Connection, Transaction, clusterApiUrl } from '@solana/web3.js'
import type { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import type { CosmosTransaction } from 'rango-sdk/lib'
import WalletConnectProvider from '@walletconnect/web3-provider'
import { useSafeAppsSDK } from '@gnosis.pm/safe-apps-react-sdk'
import { SafeAppProvider } from '@gnosis.pm/safe-apps-provider'
import type { BigNumber } from 'ethers'
import { ethers } from 'ethers'
import React, { useCallback, useMemo, useRef, useState } from 'react'

import type { Window as KeplrWindow } from '@keplr-wallet/types'
import { ERRCODE, EVM_CHAINS, LOCAL_STORAGE_WALLETS_KEY, NETWORK_IDS, SOL_CHAINS, WALLET_NAMES, WALLET_SUBNAME, cosmosChainsMap } from '../constants'
import type { TAvailableWalletNames, TWalletLocalData, TWalletState, TWalletStore } from '../types'
import { WalletStatusEnum } from '../types'
import { detectNewTxFromAddress, executeCosmosTransaction, getCluster, getCosmosConnectedWallets, getDomainAddress, goKeplr, goMetamask, goPhantom, isCosmosChain, isSolChain, mapRawWalletSubName, parseEnsFromSolanaAddress, shortenAddress } from '../utils'
import { getNetworkById, rpcMapping } from '../networks'
import { useWalletAddressesHistory } from '../hooks'
import { INITIAL_STATE, INITIAL_WALLET_STATE, WalletContext } from './WalletContext'
import { QueryProvider } from './QueryProvider'
import { isCosmosWallet, isEvmWallet, isSolWallet } from '@/utils/wallet'
import { BalanceProvider } from '@/components/balance/BalanceProvider'

declare global {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Window extends KeplrWindow {
    xfi: any
    solana: PhantomWalletAdapter & { isPhantom?: boolean }
  }
}

const WalletProvider = function WalletProvider({ children }: { children: React.ReactNode }) {
  const activeWalletNameRef = useRef<TAvailableWalletNames | null>(null)

  const setActiveWalletName = (newWalletName: TAvailableWalletNames | null) => {
    activeWalletNameRef.current = newWalletName
  }

  const [walletState, setWalletState] = useState<TWalletState>(INITIAL_WALLET_STATE)
  const [walletAddressesHistory, addWalletAddress] = useWalletAddressesHistory()

  const { sdk: safeSdk, safe: safeInfo } = useSafeAppsSDK()

  const state = useMemo(() => {
    if (activeWalletNameRef.current) {
      return walletState[activeWalletNameRef.current]
    }

    return INITIAL_STATE
  }, [activeWalletNameRef.current, walletState])

  const updateWalletState = (walletName: TAvailableWalletNames | null, newState: Partial<TWalletStore>) => {
    if (walletName) {
      setWalletState(prevState => ({ ...prevState, [walletName]: { ...prevState[walletName], ...newState } }))
    }
  }

  const updateActiveWalletName = (walletName: TAvailableWalletNames) => {
    if (!activeWalletNameRef.current) {
      setActiveWalletName(walletName)
    }
  }

  const connectCoinbase = async (chainId: number): Promise<boolean> => {
    if (!window.ethereum) {
      return false
    }

    updateWalletState('Coinbase', { status: WalletStatusEnum.LOADING })

    try {
      const CoinbaseWalletSDK = (await import('@coinbase/wallet-sdk')).default
      const coinbase = new CoinbaseWalletSDK({
        appName: document.title
      })

      const rpcUrl = rpcMapping[chainId]
      const walletProvider = coinbase.makeWeb3Provider(rpcUrl, chainId)

      const provider = new ethers.providers.Web3Provider(walletProvider as unknown as ExternalProvider, 'any')
      await provider.send('eth_requestAccounts', [])

      let { chainId: walletChainId, address, addressShort, addressDomain } = await fetchEvmWalletInfo(provider)

      walletProvider.on('chainChanged', evmChainChangeHandler as any)
      walletProvider.on('accountsChanged', evmAccountChangeHandler as any)

      updateWalletState('Coinbase', {
        isConnected: true,
        isDisconnectable: true,
        status: WalletStatusEnum.READY,
        name: WALLET_NAMES.Coinbase,
        provider,
        walletProvider,
        chainId: walletChainId,
        address,
        addressShort,
        addressDomain
      })

      localStorage.setItem('web3-wallets-name', WALLET_NAMES.Coinbase)
      localStorage.setItem(
        LOCAL_STORAGE_WALLETS_KEY,
        JSON.stringify({
          name: WALLET_NAMES.Coinbase,
          subName: null,
          chainId,
          address: addressDomain || addressShort
        })
      )

      return true
    } catch (e: any) {
      setWalletState(prev => ({ ...prev, Coinbase: { ...prev.Coinbase, status: WalletStatusEnum.NOT_INITED } }))
      if (e.code === ERRCODE.UserRejected) {
        console.warn('[Wallet] User rejected the request')
        return false
      } else {
        throw e
      }
    }
  }

  const connectMetamask = async (chainId: number): Promise<boolean> => {
    if (!window.ethereum) {
      return false
    }

    const ethereum: any = window.ethereum

    updateWalletState('MetaMask', { status: WalletStatusEnum.LOADING })

    const findedProvider = () => {
      if (ethereum.providers?.length) {
        const provider = ethereum?.providers.find((prov: any) => prov?.isMetaMask)
        if (!provider) {
          throw new Error('[WalletProvider] No provider found')
        }

        return provider
      }

      return ethereum
    }

    const walletProvider = findedProvider()

    const provider = new ethers.providers.Web3Provider(walletProvider as ExternalProvider, 'any')

    try {
      await provider.send('eth_requestAccounts', [])
    } catch (e: any) {
      updateWalletState('MetaMask', { status: WalletStatusEnum.NOT_INITED })
      if (e.code === ERRCODE.UserRejected) {
        console.warn('[Wallet] User rejected the request')
        return false
      } else {
        throw e
      }
    }

    let { chainId: walletChainId, address, addressShort, addressDomain } = await fetchEvmWalletInfo(provider)

    addWalletAddress({ [address]: EVM_CHAINS })

    walletProvider.on('chainChanged', evmChainChangeHandler as any)
    walletProvider.on('accountsChanged', evmAccountChangeHandler as any)

    updateWalletState('MetaMask', {
      isConnected: true,
      isDisconnectable: true,
      status: WalletStatusEnum.READY,
      name: WALLET_NAMES.MetaMask,
      provider,
      walletProvider,
      chainId: walletChainId,
      address,
      addressShort,
      addressDomain
    })

    localStorage.setItem('web3-wallets-name', WALLET_NAMES.MetaMask)
    localStorage.setItem(
      LOCAL_STORAGE_WALLETS_KEY,
      JSON.stringify({
        name: WALLET_NAMES.MetaMask,
        subName: null,
        chainId,
        address: addressDomain || addressShort
      })
    )

    return true
  }

  const connectxDefi = async (chainId: number): Promise<boolean> => {
    if (!window.xfi.ethereum) {
      return false
    }

    updateWalletState('xDefi', { status: WalletStatusEnum.LOADING })

    const walletProvider = window.xfi.ethereum

    const provider = new ethers.providers.Web3Provider(walletProvider, 'any')

    try {
      await provider.send('eth_requestAccounts', [])
    } catch (e: any) {
      updateWalletState('xDefi', { status: WalletStatusEnum.NOT_INITED })
      if (e.code === ERRCODE.UserRejected) {
        console.warn('[Wallet] User rejected the request')
        return false
      } else {
        throw e
      }
    }

    let { chainId: walletChainId, address, addressShort, addressDomain } = await fetchEvmWalletInfo(provider)

    walletProvider.on('chainChanged', evmChainChangeHandler as any)
    walletProvider.on('accountsChanged', evmAccountChangeHandler as any)

    updateWalletState('xDefi', {
      isConnected: true,
      isDisconnectable: true,
      status: WalletStatusEnum.READY,
      name: WALLET_NAMES.xDefi,
      provider,
      walletProvider,
      chainId: walletChainId,
      address,
      addressShort,
      addressDomain
    })

    localStorage.setItem('web3-wallets-name', WALLET_NAMES.xDefi)
    localStorage.setItem(
      LOCAL_STORAGE_WALLETS_KEY,
      JSON.stringify({
        name: WALLET_NAMES.xDefi,
        subName: null,
        chainId,
        address: addressDomain || addressShort
      })
    )

    return true
  }

  const connectWC = async (chainId: number): Promise<boolean> => {
    updateWalletState('WalletConnect', { status: WalletStatusEnum.LOADING })

    try {
      const walletConnectProvider = new WalletConnectProvider({
        rpc: rpcMapping,
        chainId
      })

      await walletConnectProvider.enable()
      const web3Provider = new ethers.providers.Web3Provider(walletConnectProvider, 'any')

      const {
        chainId: walletChainId,
        address,
        addressShort,
        addressDomain
      } = await fetchEvmWalletInfo(web3Provider)

      const rawSubName = walletConnectProvider.walletMeta?.name
      const subName = rawSubName ? mapRawWalletSubName(rawSubName) : null

      walletConnectProvider.on('disconnect', (code: number, reason: string) => {
        console.log('WalletConnectProvider disconnected', code, reason)
        disconnect() // todo: only clear state (without duplicate code and disconnect events)
      })
      walletConnectProvider.on('chainChanged', evmChainChangeHandler)
      walletConnectProvider.on('accountsChanged', evmAccountChangeHandler)

      updateWalletState('WalletConnect', {
        isConnected: true,
        isDisconnectable: true,
        status: WalletStatusEnum.READY,
        name: WALLET_NAMES.WalletConnect,
        subName,
        provider: web3Provider,
        walletProvider: walletConnectProvider,
        chainId: walletChainId,
        address,
        addressShort,
        addressDomain
      })

      localStorage.setItem('web3-wallets-name', WALLET_NAMES.WalletConnect)
      localStorage.setItem(
        LOCAL_STORAGE_WALLETS_KEY,
        JSON.stringify({
          name: WALLET_NAMES.WalletConnect,
          subName,
          chainId,
          address: addressDomain || addressShort
        })
      )

      return true
    } catch (err: any) {
      updateWalletState('WalletConnect', { status: WalletStatusEnum.NOT_INITED })
      if (err.toString().includes('User closed modal')) {
        return false
      }
      console.error('[Wallet] connectWC error:', err)
      throw new Error(err)
    }
  }

  const connectPhantom = async (chainId: number = NETWORK_IDS.Solana) => {
    if (!isSolChain(chainId)) {
      throw new Error(`Unknown Phantom chainId ${chainId}`)
    }
    updateWalletState('Phantom', { status: WalletStatusEnum.LOADING })
    try {
      await window.solana.connect()
      const address = window.solana.publicKey!.toString()
      const addressDomain = await parseEnsFromSolanaAddress(address)
      const provider = window.solana
      const cluster = getCluster(chainId)
      const solanaNetwork = clusterApiUrl(cluster)
      const connection = new Connection(solanaNetwork)
      const addressShort = shortenAddress(address)

      addWalletAddress({ [address]: SOL_CHAINS })
      updateWalletState('Phantom', {
        isConnected: true,
        isDisconnectable: true,
        status: WalletStatusEnum.READY,
        name: 'Phantom',
        provider,
        chainId,
        address,
        connection,
        addressShort,
        addressDomain
      })

      localStorage.setItem('web3-wallets-name', WALLET_NAMES.Phantom)
      localStorage.setItem(
        LOCAL_STORAGE_WALLETS_KEY,
        JSON.stringify({
          name: WALLET_NAMES.Phantom,
          subName: null,
          chainId,
          address: addressDomain || addressShort
        })
      )
      return true
    } catch (err: any) {
      updateWalletState('Phantom', { status: WalletStatusEnum.NOT_INITED })
      if (err.code === ERRCODE.UserRejected) {
        console.warn('[Wallet] User rejected the request.')
      }
      console.error('[Wallet]', err)
      return false
    }
  }

  const connectKeplr = async (chainId: number) => {
    if (!(isCosmosChain(chainId))) {
      throw new Error(`Keplr chainId ${chainId} is not supported`)
    }

    try {
      if (window.keplr) {
        updateWalletState('Keplr', { status: WalletStatusEnum.LOADING })

        const chainxList = Object.values(cosmosChainsMap)
        const currentChain = cosmosChainsMap[chainId as keyof typeof cosmosChainsMap]

        const provider = window.keplr

        await provider.enable(chainxList)

        const offlineSigner = provider.getOfflineSigner(currentChain)
        const addressesList = await offlineSigner.getAccounts()
        const { address } = addressesList[0]
        const addressShort = shortenAddress(address)
        const connectedWallets = await getCosmosConnectedWallets(provider)
        const addresesInfo = connectedWallets.reduce((acc, { addresses, chainId }) => ({ ...acc, [addresses[0]]: [chainId] }), {})

        addWalletAddress(addresesInfo)
        updateWalletState('Keplr', {
          isConnected: true,
          isDisconnectable: true,
          status: WalletStatusEnum.READY,
          connectedWallets,
          name: 'Keplr',
          chainId,
          address,
          addressShort,
          provider
        })

        localStorage.setItem('web3-wallets-name', WALLET_NAMES.Keplr)
        localStorage.setItem(
          LOCAL_STORAGE_WALLETS_KEY,
          JSON.stringify({
            name: WALLET_NAMES.Keplr,
            chainId,
            address: addressShort
          })
        )

        return true
      }
    } catch (err: any) {
      updateWalletState('Keplr', { status: WalletStatusEnum.NOT_INITED })
      console.error('[Wallet] connectWC error:', err)
      return false
    }

    return false
  }

  const connectSafe = async (): Promise<boolean> => {
    updateActiveWalletName('Safe')
    updateWalletState('Safe', { status: WalletStatusEnum.LOADING })

    try {
      const safeProvider = new SafeAppProvider(safeInfo, safeSdk)
      const web3Provider = new ethers.providers.Web3Provider(safeProvider, 'any')

      console.log('safeProvider', safeProvider)
      console.log('web3Provider', web3Provider)

      const {
        chainId,
        address,
        addressShort,
        addressDomain
      } = await fetchEvmWalletInfo(web3Provider)

      console.log('chainId', chainId)
      console.log('address', address)

      safeProvider.on('disconnect', (code: number, reason: string) => {
        console.log('safeProvider disconnected', code, reason)
        disconnect() // todo: only clear state (without duplicate code and disconnect events)
      })
      safeProvider.on('chainChanged', evmChainChangeHandler)
      safeProvider.on('accountsChanged', evmAccountChangeHandler)

      updateWalletState('Safe', {
        isConnected: true,
        isDisconnectable: false,
        status: WalletStatusEnum.READY,
        name: WALLET_NAMES.Safe,
        subName: null,
        provider: web3Provider,
        walletProvider: safeProvider,
        chainId,
        address,
        addressShort,
        addressDomain
      })

      localStorage.setItem('web3-wallets-name', WALLET_NAMES.Safe)
      localStorage.setItem(
        LOCAL_STORAGE_WALLETS_KEY,
        JSON.stringify({
          name: WALLET_NAMES.WalletConnect,
          chainId,
          address: addressDomain || addressShort
        })
      )

      return true
    } catch (err: any) {
      updateWalletState('Safe', { status: WalletStatusEnum.NOT_INITED })
      console.error('[Wallet] connectSafe error:', err)
      throw new Error(err)
    }
  }

  const connect = async ({ name, chainId }: { name: string; chainId: number }): Promise<boolean> => {
    console.log('[Wallet] connect()', name, chainId)
    if (!(Object.values(WALLET_NAMES) as string[]).includes(name)) {
      console.error(`[Wallet] Unknown wallet name: ${name}`)
      return false
    }

    if (name === WALLET_NAMES.MetaMask) {
      if (!window.ethereum) {
        goMetamask()
        return false
      }
      updateActiveWalletName('MetaMask')
      return connectMetamask(chainId)
    }

    if (name === WALLET_NAMES.Coinbase) {
      if (!window.ethereum) {
        // TODO: Add link to coinbase
        return false
      }
      updateActiveWalletName('Coinbase')
      return connectCoinbase(chainId)
    }

    if (name === WALLET_NAMES.WalletConnect) {
      updateActiveWalletName('WalletConnect')
      return connectWC(chainId)
    }

    if (name === WALLET_NAMES.xDefi) {
      updateActiveWalletName('xDefi')
      return connectxDefi(chainId)
    }

    if (name === WALLET_NAMES.Phantom) {
      const isPhantomInstalled = window.solana && window.solana.isPhantom
      if (!isPhantomInstalled) {
        goPhantom()
        return false
      }
      updateActiveWalletName('Phantom')
      return connectPhantom(chainId)
    }

    if (name === WALLET_NAMES.Keplr) {
      const isKeplrInstalled = window.keplr

      if (!isKeplrInstalled) {
        goKeplr()
        return false
      }
      updateActiveWalletName('Keplr')
      return connectKeplr(chainId)
    }

    return false
  }

  const restore = async () => {
    console.log('Wallet.restore()')

    const isSafeAutoconnected = await connectSafe()
    if (isSafeAutoconnected) {
      return
    }

    const walletData = localStorage.getItem(LOCAL_STORAGE_WALLETS_KEY)

    if (walletData) {
      const { name, chainId } = JSON.parse(walletData) as TWalletLocalData

      return connect({ name, chainId })
    }

    return false
  }

  const evmChainChangeHandler = async (chainIdHex: string) => {
    const chainId = parseInt(chainIdHex)
    console.log('* chainChanged', chainIdHex, chainId)

    updateWalletState(activeWalletNameRef.current, { chainId })
  }

  const evmChangeNetwork = async (params: any[]): Promise<boolean> => {
    if (!state.provider || !isEvmWallet(state)) {
      return false
    }
    const { provider } = state
    const newChainIdHex = params[0].chainId

    try {
      await provider.send('wallet_switchEthereumChain', [
        {
          chainId: newChainIdHex
        }
      ])
      return true
    } catch (error: any) {
      if (error.code === ERRCODE.UserRejected) {
        console.warn('[Wallet] User rejected the request')
        return false
      }

      if (error.code === ERRCODE.UnrecognizedChain || error.code === ERRCODE.UnrecognizedChain2) {
        // the chain has not been added to wallet
        try {
          console.log('[Wallet] Try to add the network...', params)
          await provider.send('wallet_addEthereumChain', params)
          // todo: Users can allow adding, but not allowing switching
          return true
        } catch (addNetworkError: any) {
          if (addNetworkError.code === ERRCODE.UserRejected) {
            console.warn('[Wallet] User rejected the request')
            return false
          }
          console.warn('[Wallet] Cant add the network:', addNetworkError)
          return false
        }
      }
      console.error('[Wallet] Cant change network:', error)
      return false
    }
  }

  const disconnect = () => {
    console.log('[Wallet] disconnect()')

    if (!state.name) {
      return false
    }

    if (isEvmWallet(state)) {
      if (state.walletProvider) {
        state.walletProvider.removeAllListeners()
        if (state.walletProvider instanceof WalletConnectProvider) {
          state.walletProvider?.disconnect()
        }
      }
    }

    if (isSolWallet(state)) {
      window.solana.disconnect()
    }

    updateWalletState(activeWalletNameRef.current, {
      isConnected: false,
      isDisconnectable: false,
      name: null,
      provider: null,
      walletProvider: null,
      chainId: null,
      address: null,
      addressShort: null,
      addressDomain: null,
      balance: null,
      connection: null
    })

    setActiveWalletName(null)

    localStorage.removeItem('web3-wallets-name')
    localStorage.removeItem(LOCAL_STORAGE_WALLETS_KEY)
    localStorage.removeItem('isFirstInited')
  }

  const evmAccountChangeHandler = async (accounts: string[]) => {
    console.log('* accountsChanged', accounts)

    if (!accounts.length) {
      disconnect()
    }

    const address = accounts[0]
    const addressDomain = await getDomainAddress(address)

    addWalletAddress({ [address]: EVM_CHAINS })

    updateWalletState(activeWalletNameRef.current, {
      address,
      addressShort: shortenAddress(address),
      addressDomain
    })
  }

  const changeNetwork = async (chainId: number) => {
    console.log('[Wallet] changeNetwork()', chainId)
    if (!state.name) {
      return false
    }

    const network = getNetworkById(chainId)
    const { params } = network.data

    if (isEvmWallet(state)) {
      const isChanged = await evmChangeNetwork(params)
      if (isChanged) {
        localStorage.setItem(
          LOCAL_STORAGE_WALLETS_KEY,
          JSON.stringify({
            name: state.name,
            subName: state.subName,
            chainId,
            address: state.addressDomain || state.addressShort
          })
        )
      }
      return isChanged
    }

    console.error('[Wallet] changeNetwork error: not implemented')
    return false
  }

  const sendTx = async (
    transaction: TransactionRequest | Transaction | CosmosTransaction,
    params?: {
      signers?: Signer[]
      walletName?: TAvailableWalletNames
    }
  ): Promise<string> => {
    const { walletName } = params || {}
    const currentName = walletName || activeWalletNameRef.current

    if (!currentName) {
      throw new Error('[Wallet] sendTx error: no wallet name')
    }

    const currentState = walletState[currentName]
    // todo: sendTx reject => false
    console.log('[Wallet] sendTx', transaction)

    const isSolanaTransaction = transaction instanceof Transaction

    try {
      if (isSolanaTransaction) {
        const cluster = getCluster(currentState.chainId)
        const solanaNetwork = clusterApiUrl(cluster)
        const connection = new Connection(solanaNetwork)

        // @ts-expect-error need types for state provider
        transaction.feePayer = currentState.provider.publicKey
        console.warn('Getting recent blockhash')
        transaction.recentBlockhash = transaction.recentBlockhash || (await connection.getLatestBlockhash()).blockhash

        if (params?.signers?.length) {
          transaction.partialSign(...params.signers)
          console.log('partialSigned')
        }

        // @ts-expect-error Solana need to be refactored
        const signed = await currentState.provider.signTransaction(transaction)
        console.log('signed', signed)
        console.log('Got signature, submitting transaction...')
        const rawTx = signed.serialize()
        const signature = await connection.sendRawTransaction(rawTx)
        // todo: sendRawTransaction Commitment
        console.log('Tx submitted', signature)
        await (async () => {
          console.log('Waiting for network confirmation...')
          await connection.confirmTransaction(signature)
          console.log('Tx confirmed!', signature)
          console.log('See explorer:')
          console.log(`https://solscan.io/tx/${signature}${cluster === 'testnet' ? '?cluster=testnet' : ''}`)
        })()
        return signature
      } else if (isEvmWallet(currentState)) {
        // EVM tx
        const signer = currentState.provider!.getSigner()
        const tx = transaction as TransactionRequest

        try {
          // EVM + Gnosis Safe tx
          if (currentState.name === WALLET_NAMES.WalletConnect && currentState.subName === WALLET_SUBNAME.GnosisSafe && currentState.walletProvider instanceof WalletConnectProvider) {
          /*
            Gnosis Safe cannot immediately return the transaction by design.
            Multi-signature can be done much later.
            It remains only to wait for the appearance of a new transaction from the sender's address (detectNewTxFromAddress)
          */
            return await Promise.race([
            // However, sendTransaction can still throw if the transaction is rejected by the user
              signer?.sendTransaction(tx) as never,
              detectNewTxFromAddress(currentState.address!, currentState.provider!)
            ])
          }

          // ordinary EVM tx
          const sendedTransaction = await signer?.sendTransaction(tx)
          return sendedTransaction.hash
        } catch (err: any) {
          if (err.code === ERRCODE.UserRejected) {
            console.warn('[Wallet] User rejected the request')
            throw err // return false // todo: sendTx reject => false
          }
          throw err
        }
      } else if (isCosmosWallet(currentState)) {
        return await executeCosmosTransaction(transaction as CosmosTransaction, currentState.provider)
      } else {
        throw new Error('[Wallet] sendTx error: wallet is not supported')
      }
    } catch (err) {
      console.error(`[Wallet] sendTx error: ${JSON.stringify(err)}`)
      throw err
    }
  }

  const estimateGas = async (data: TransactionRequest): Promise<BigNumber | undefined> => {
    if (state.provider && 'estimateGas' in state.provider) {
      return state.provider.estimateGas(data)
    }
  }

  const fetchEvmWalletInfo = async (provider: ethers.providers.Web3Provider) => {
    const address = await provider.getSigner().getAddress()

    let addressDomain = null
    try {
      addressDomain = await getDomainAddress(address)
    } catch (e) {
      console.error(e)
    }

    const addressShort = shortenAddress(address)
    const { chainId } = await provider.getNetwork()

    return {
      chainId,
      address,
      addressShort,
      addressDomain
    }
  }

  const waitForTransaction = async (hash: string, { confirmations, fromChainId }: { confirmations?: number; fromChainId?: number } = {}): Promise<void> => {
    const currentChainId = fromChainId || state.chainId

    if (currentChainId === NETWORK_IDS.Solana) {
      const cluster = getCluster(currentChainId)
      const solanaNetwork = clusterApiUrl(cluster)
      const connection = new Connection(solanaNetwork)

      try {
        await connection.getTransaction(hash)
      } catch (e) {
        throw new Error('[Wallet] waitForTransaction error: execution reverted')
      }
    } else if (isEvmWallet(state)) {
      // EVM tx
      // Status 0 === Tx Reverted
      // @see https://docs.ethers.io/v5/api/providers/types/#providers-TransactionReceipt
      const REVERTED_STATUS = 0

      if (!state.provider) {
        throw new Error('[Wallet] waitForTransaction error: no provider')
      }

      const tx = await state.provider.waitForTransaction(hash, confirmations)
      if (!tx.confirmations || tx.status === REVERTED_STATUS) {
        throw new Error('[Wallet] waitForTransaction error: execution reverted')
      }
    }
    // todo: add cosmos support
  }

  const getTransaction = async (hash: string) => {
    if (isEvmWallet(state)) {
      // Status 0 === Tx Reverted
      // @see https://docs.ethers.io/v5/api/providers/types/#providers-TransactionReceipt
      const REVERTED_STATUS = 0

      if (!state.provider) {
        throw new Error('[Wallet] getTransaction error: no provider')
      }

      const tx = await state.provider.getTransactionReceipt(hash)
      if (!tx.confirmations || tx.status === REVERTED_STATUS) {
        throw new Error('[Wallet] getTransaction error: execution reverted')
      }

      return tx
    } else {
      throw new Error('[Wallet] getTransaction error: method not supported yet')
    }
  }

  const setBalance = useCallback((balance: string | null) => updateWalletState(state.name, {
    balance
  }), [state.name])

  const providerState = useMemo(() => ({
    isConnected: state.isConnected,
    isDisconnectable: state.isDisconnectable,
    walletAddressesHistory,
    status: state.status,
    name: state.name,
    subName: state.subName,
    chainId: state.chainId,
    address: state.address,
    addressShort: state.addressShort,
    addressDomain: state.addressDomain,
    balance: state.balance,
    connection: state.connection,
    estimateGas,
    provider: state.provider,
    walletProvider: state.walletProvider,
    waitForTransaction,
    getTransaction,
    restore,
    connect,
    changeNetwork,
    connectedWallets: state.connectedWallets,
    sendTx,
    disconnect,
    walletState
  }), [state, walletAddressesHistory, estimateGas, waitForTransaction, getTransaction, restore, connect, changeNetwork, sendTx, disconnect, walletState])

  return (
    <WalletContext.Provider
    // @ts-expect-error https://linear.app/via-protocol/issue/FRD-640/ispravit-oshibku-s-tipami-v-web3-wallets
      value={providerState}
    >
      <QueryProvider>
        {children}
        <BalanceProvider options={state} setBalance={setBalance} />
      </QueryProvider>
    </WalletContext.Provider>
  )
}

export { WalletProvider }
