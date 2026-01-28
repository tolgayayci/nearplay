import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { setupWalletSelector, WalletSelector } from '@near-wallet-selector/core';
import { setupModal, WalletSelectorModal } from '@near-wallet-selector/modal-ui';
import { setupMeteorWallet } from '@near-wallet-selector/meteor-wallet';
import { useRPC } from './RPCContext';

// Import wallet selector CSS
import '@near-wallet-selector/modal-ui/styles.css';

export type DeploymentMode = 'playground' | 'wallet';
export type Network = 'testnet' | 'mainnet';

export interface AccountBalance {
  available: string;
  stateStaked: string;
  staked: string;
  total: string;
}

interface WalletContextState {
  // Deployment mode
  deploymentMode: DeploymentMode;
  setDeploymentMode: (mode: DeploymentMode) => void;

  // Network
  network: Network;
  setNetwork: (network: Network) => void;

  // Connection state
  isConnected: boolean;
  accountId: string | null;
  accountBalance: AccountBalance | null;
  walletId: string | null;

  // Wallet selector
  selector: WalletSelector | null;
  modal: WalletSelectorModal | null;

  // Loading states
  isInitializing: boolean;
  isLoadingBalance: boolean;

  // Actions
  connectWallet: () => void;
  disconnectWallet: () => Promise<void>;
  refreshBalance: () => Promise<void>;
  getActiveWallet: () => Promise<any>;
}

const WalletContext = createContext<WalletContextState | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const { getCurrentRpcUrl } = useRPC();

  // Deployment mode - default to playground for easier onboarding
  const [deploymentMode, setDeploymentModeState] = useState<DeploymentMode>(() => {
    if (typeof window === 'undefined') return 'playground';
    const saved = localStorage.getItem('deployment_mode');
    return (saved as DeploymentMode) || 'playground';
  });

  // Network - default to testnet
  const [network, setNetworkState] = useState<Network>(() => {
    if (typeof window === 'undefined') return 'testnet';
    const saved = localStorage.getItem('selected_network');
    return (saved as Network) || 'testnet';
  });

  // Wallet state
  const [selector, setSelector] = useState<WalletSelector | null>(null);
  const [modal, setModal] = useState<WalletSelectorModal | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountBalance, setAccountBalance] = useState<AccountBalance | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);

  // Loading states
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Persist deployment mode
  const setDeploymentMode = useCallback((mode: DeploymentMode) => {
    setDeploymentModeState(mode);
    localStorage.setItem('deployment_mode', mode);
  }, []);

  // Persist network
  const setNetwork = useCallback((newNetwork: Network) => {
    setNetworkState(newNetwork);
    localStorage.setItem('selected_network', newNetwork);
  }, []);

  // Initialize wallet selector
  useEffect(() => {
    let mounted = true;

    const initWalletSelector = async () => {
      setIsInitializing(true);

      try {
        const rpcUrl = getCurrentRpcUrl(network);

        // Configure supported NEAR wallets (Meteor only - most compatible)
        const walletModules = [
          setupMeteorWallet(),
        ];

        const newSelector = await setupWalletSelector({
          network: {
            networkId: network,
            nodeUrl: rpcUrl,
          },
          modules: walletModules,
        });

        if (!mounted) return;

        const newModal = setupModal(newSelector, {
          contractId: '', // No specific contract - we deploy to user's account
        });

        // Get initial state
        const state = newSelector.store.getState();
        const accounts = state.accounts;

        if (accounts.length > 0) {
          setAccountId(accounts[0].accountId);
          setWalletId(state.selectedWalletId || null);
        } else {
          setAccountId(null);
          setAccountBalance(null);
          setWalletId(null);
        }

        // Subscribe to account changes
        const subscription = newSelector.store.observable.subscribe((newState) => {
          const newAccounts = newState.accounts;
          if (newAccounts.length > 0) {
            setAccountId(newAccounts[0].accountId);
            setWalletId(newState.selectedWalletId || null);
          } else {
            setAccountId(null);
            setAccountBalance(null);
            setWalletId(null);
          }
        });

        setSelector(newSelector);
        setModal(newModal);
        setIsInitializing(false);

        return () => {
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('Failed to initialize wallet selector:', error);
        setIsInitializing(false);
      }
    };

    initWalletSelector();

    return () => {
      mounted = false;
    };
  }, [network, getCurrentRpcUrl]);

  // Fetch account balance when account changes
  const refreshBalance = useCallback(async () => {
    if (!accountId || !selector) {
      setAccountBalance(null);
      return;
    }

    setIsLoadingBalance(true);

    try {
      const rpcUrl = getCurrentRpcUrl(network);
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'query',
          params: {
            request_type: 'view_account',
            account_id: accountId,
            finality: 'final',
          },
        }),
      });

      const data = await response.json();

      if (data.result) {
        const { amount, locked, storage_usage } = data.result;
        // Calculate available balance (total - locked - storage cost)
        // Storage cost is roughly 1 NEAR per 100KB
        const storageCost = BigInt(storage_usage) * BigInt('10000000000000000000'); // 0.00001 NEAR per byte
        const total = BigInt(amount);
        const lockedAmount = BigInt(locked);
        const available = total - lockedAmount - storageCost;

        setAccountBalance({
          total: amount,
          stateStaked: storageCost.toString(),
          staked: locked,
          available: available > 0n ? available.toString() : '0',
        });
      }
    } catch (error) {
      console.error('Failed to fetch account balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [accountId, selector, network, getCurrentRpcUrl]);

  // Refresh balance when account changes
  useEffect(() => {
    if (accountId) {
      refreshBalance();
    }
  }, [accountId, refreshBalance]);

  // Connect wallet
  const connectWallet = useCallback(() => {
    if (modal) {
      modal.show();
    }
  }, [modal]);

  // Disconnect wallet
  const disconnectWallet = useCallback(async () => {
    if (selector) {
      const wallet = await selector.wallet();
      await wallet.signOut();
      setAccountId(null);
      setAccountBalance(null);
      setWalletId(null);
    }
  }, [selector]);

  // Get active wallet instance
  const getActiveWallet = useCallback(async () => {
    if (!selector) return null;
    try {
      return await selector.wallet();
    } catch {
      return null;
    }
  }, [selector]);

  const isConnected = !!accountId && deploymentMode === 'wallet';

  return (
    <WalletContext.Provider value={{
      deploymentMode,
      setDeploymentMode,
      network,
      setNetwork,
      isConnected,
      accountId,
      accountBalance,
      walletId,
      selector,
      modal,
      isInitializing,
      isLoadingBalance,
      connectWallet,
      disconnectWallet,
      refreshBalance,
      getActiveWallet,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

// Utility function to format NEAR amount
export function formatNearAmount(yoctoNear: string): string {
  const near = BigInt(yoctoNear) / BigInt('1000000000000000000000000');
  const remainder = BigInt(yoctoNear) % BigInt('1000000000000000000000000');
  const decimal = remainder.toString().padStart(24, '0').slice(0, 4);
  return `${near}.${decimal}`;
}

// Wallet display names mapping
const WALLET_DISPLAY_NAMES: Record<string, string> = {
  'meteor-wallet': 'Meteor Wallet',
  'hot-wallet': 'HOT Wallet',
};

// Utility function to get wallet display name
export function getWalletDisplayName(walletId: string | null): string {
  if (!walletId) return 'Wallet';
  return WALLET_DISPLAY_NAMES[walletId] || walletId;
}
