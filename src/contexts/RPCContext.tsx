import { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';

export interface RPCProvider {
  id: string;
  name: string;
  testnetUrl: string;
  mainnetUrl: string;
  isCustom?: boolean;
}

export interface ConnectionStatus {
  connected: boolean;
  latency: number | null;
  lastChecked: number | null;
}

interface RPCContextState {
  // Provider lists
  providers: RPCProvider[];
  customProviders: RPCProvider[];

  // Current selection per network
  selectedTestnetProvider: string;
  selectedMainnetProvider: string;

  // Connection status per provider
  connectionStatus: Record<string, ConnectionStatus>;

  // Actions
  setProvider: (network: 'testnet' | 'mainnet', providerId: string) => void;
  addCustomProvider: (provider: Omit<RPCProvider, 'id' | 'isCustom'>) => void;
  removeCustomProvider: (providerId: string) => void;
  testConnection: (providerId: string, network: 'testnet' | 'mainnet') => Promise<ConnectionStatus>;
  testAllConnections: (network: 'testnet' | 'mainnet') => Promise<void>;
  getCurrentRpcUrl: (network: 'testnet' | 'mainnet') => string;
  getProviderById: (providerId: string) => RPCProvider | undefined;
}

// Default providers
export const DEFAULT_PROVIDERS: RPCProvider[] = [
  {
    id: 'near-official',
    name: 'NEAR Official',
    testnetUrl: 'https://rpc.testnet.near.org',
    mainnetUrl: 'https://rpc.mainnet.near.org',
  },
  {
    id: 'fastnear',
    name: 'FastNEAR',
    testnetUrl: 'https://test.rpc.fastnear.com',
    mainnetUrl: 'https://free.rpc.fastnear.com',
  },
  {
    id: 'lava',
    name: 'Lava Network',
    testnetUrl: 'https://neart.lava.build:443',
    mainnetUrl: 'https://near.lava.build:443',
  },
];

const RPCContext = createContext<RPCContextState | null>(null);

export function useRPC() {
  const context = useContext(RPCContext);
  if (!context) {
    throw new Error('useRPC must be used within RPCProvider');
  }
  return context;
}

interface RPCProviderProps {
  children: ReactNode;
}

export function RPCProvider({ children }: RPCProviderProps) {
  // Load saved preferences from localStorage
  const [selectedTestnetProvider, setSelectedTestnetProvider] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('rpc_testnet_provider') || 'near-official'
      : 'near-official'
  );

  const [selectedMainnetProvider, setSelectedMainnetProvider] = useState(() =>
    typeof window !== 'undefined'
      ? localStorage.getItem('rpc_mainnet_provider') || 'fastnear'
      : 'fastnear'
  );

  const [customProviders, setCustomProviders] = useState<RPCProvider[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = localStorage.getItem('rpc_custom_providers');
    return saved ? JSON.parse(saved) : [];
  });

  const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatus>>({});

  // All providers combined - memoized to prevent unnecessary re-renders
  const providers = useMemo(() => [...DEFAULT_PROVIDERS, ...customProviders], [customProviders]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('rpc_testnet_provider', selectedTestnetProvider);
  }, [selectedTestnetProvider]);

  useEffect(() => {
    localStorage.setItem('rpc_mainnet_provider', selectedMainnetProvider);
  }, [selectedMainnetProvider]);

  useEffect(() => {
    localStorage.setItem('rpc_custom_providers', JSON.stringify(customProviders));
  }, [customProviders]);

  // Test RPC connection
  const testConnection = useCallback(async (
    providerId: string,
    network: 'testnet' | 'mainnet'
  ): Promise<ConnectionStatus> => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) {
      return { connected: false, latency: null, lastChecked: Date.now() };
    }

    const url = network === 'testnet' ? provider.testnetUrl : provider.mainnetUrl;
    const start = Date.now();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'test',
          method: 'status',
          params: [],
        }),
      });

      const latency = Date.now() - start;
      const status: ConnectionStatus = {
        connected: response.ok,
        latency: response.ok ? latency : null,
        lastChecked: Date.now(),
      };

      setConnectionStatus(prev => ({
        ...prev,
        [`${providerId}-${network}`]: status,
      }));

      return status;
    } catch {
      const status: ConnectionStatus = {
        connected: false,
        latency: null,
        lastChecked: Date.now(),
      };

      setConnectionStatus(prev => ({
        ...prev,
        [`${providerId}-${network}`]: status,
      }));

      return status;
    }
  }, [providers]);

  // Test all provider connections
  const testAllConnections = useCallback(async (network: 'testnet' | 'mainnet') => {
    const promises = providers.map(provider => testConnection(provider.id, network));
    await Promise.all(promises);
  }, [providers, testConnection]);

  // Refs to avoid infinite loops in the interval effect
  const selectedTestnetRef = useRef(selectedTestnetProvider);
  const selectedMainnetRef = useRef(selectedMainnetProvider);
  const providersRef = useRef(providers);

  // Keep refs in sync
  useEffect(() => {
    selectedTestnetRef.current = selectedTestnetProvider;
    selectedMainnetRef.current = selectedMainnetProvider;
    providersRef.current = providers;
  }, [selectedTestnetProvider, selectedMainnetProvider, providers]);

  // Auto-test current provider every minute
  useEffect(() => {
    // Test function that uses refs
    const testCurrentProviders = async () => {
      const testnetProvider = providersRef.current.find(p => p.id === selectedTestnetRef.current);
      const mainnetProvider = providersRef.current.find(p => p.id === selectedMainnetRef.current);

      if (testnetProvider) {
        const startTime = Date.now();
        try {
          const response = await fetch(testnetProvider.testnetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 'test', method: 'status', params: [] }),
          });
          const latency = Date.now() - startTime;
          setConnectionStatus(prev => ({
            ...prev,
            [`${testnetProvider.id}-testnet`]: {
              connected: response.ok,
              latency: response.ok ? latency : null,
              lastChecked: Date.now(),
            },
          }));
        } catch {
          setConnectionStatus(prev => ({
            ...prev,
            [`${testnetProvider.id}-testnet`]: { connected: false, latency: null, lastChecked: Date.now() },
          }));
        }
      }

      if (mainnetProvider) {
        const startTime = Date.now();
        try {
          const response = await fetch(mainnetProvider.mainnetUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jsonrpc: '2.0', id: 'test', method: 'status', params: [] }),
          });
          const latency = Date.now() - startTime;
          setConnectionStatus(prev => ({
            ...prev,
            [`${mainnetProvider.id}-mainnet`]: {
              connected: response.ok,
              latency: response.ok ? latency : null,
              lastChecked: Date.now(),
            },
          }));
        } catch {
          setConnectionStatus(prev => ({
            ...prev,
            [`${mainnetProvider.id}-mainnet`]: { connected: false, latency: null, lastChecked: Date.now() },
          }));
        }
      }
    };

    // Initial test after a short delay
    const initialTimeout = setTimeout(testCurrentProviders, 1000);

    // Set up interval for every 60 seconds
    const interval = setInterval(testCurrentProviders, 60000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, []); // Empty deps - uses refs

  // Ref for testConnection to avoid dependency issues
  const testConnectionRef = useRef(testConnection);
  useEffect(() => {
    testConnectionRef.current = testConnection;
  }, [testConnection]);

  // Set provider for a network and test it immediately
  const setProvider = useCallback((network: 'testnet' | 'mainnet', providerId: string) => {
    if (network === 'testnet') {
      setSelectedTestnetProvider(providerId);
    } else {
      setSelectedMainnetProvider(providerId);
    }
    // Test the new provider immediately using ref to avoid dependency
    setTimeout(() => {
      testConnectionRef.current(providerId, network);
    }, 0);
  }, []);

  // Add custom provider
  const addCustomProvider = useCallback((provider: Omit<RPCProvider, 'id' | 'isCustom'>) => {
    const newProvider: RPCProvider = {
      ...provider,
      id: `custom-${Date.now()}`,
      isCustom: true,
    };
    setCustomProviders(prev => [...prev, newProvider]);
  }, []);

  // Remove custom provider
  const removeCustomProvider = useCallback((providerId: string) => {
    setCustomProviders(prev => prev.filter(p => p.id !== providerId));

    // Reset selection if removed provider was selected
    if (selectedTestnetProvider === providerId) {
      setSelectedTestnetProvider('near-official');
    }
    if (selectedMainnetProvider === providerId) {
      setSelectedMainnetProvider('fastnear');
    }
  }, [selectedTestnetProvider, selectedMainnetProvider]);

  // Get current RPC URL for a network
  const getCurrentRpcUrl = useCallback((network: 'testnet' | 'mainnet'): string => {
    const providerId = network === 'testnet' ? selectedTestnetProvider : selectedMainnetProvider;
    const provider = providers.find(p => p.id === providerId);

    if (provider) {
      return network === 'testnet' ? provider.testnetUrl : provider.mainnetUrl;
    }

    // Fallback to fastnear for mainnet (near-official is deprecated), official for testnet
    return network === 'testnet'
      ? DEFAULT_PROVIDERS[0].testnetUrl
      : DEFAULT_PROVIDERS[1].mainnetUrl; // fastnear
  }, [providers, selectedTestnetProvider, selectedMainnetProvider]);

  // Get provider by ID
  const getProviderById = useCallback((providerId: string): RPCProvider | undefined => {
    return providers.find(p => p.id === providerId);
  }, [providers]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    providers,
    customProviders,
    selectedTestnetProvider,
    selectedMainnetProvider,
    connectionStatus,
    setProvider,
    addCustomProvider,
    removeCustomProvider,
    testConnection,
    testAllConnections,
    getCurrentRpcUrl,
    getProviderById,
  }), [
    providers,
    customProviders,
    selectedTestnetProvider,
    selectedMainnetProvider,
    connectionStatus,
    setProvider,
    addCustomProvider,
    removeCustomProvider,
    testConnection,
    testAllConnections,
    getCurrentRpcUrl,
    getProviderById,
  ]);

  return (
    <RPCContext.Provider value={contextValue}>
      {children}
    </RPCContext.Provider>
  );
}
