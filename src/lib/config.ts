// API Configuration
export const API_URL = import.meta.env.VITE_API_URL;

// NEAR Network Configuration
export const NEAR_CONFIG = {
  testnet: {
    networkId: "testnet",
    nodeUrl: "https://rpc.testnet.near.org",
    walletUrl: "https://wallet.testnet.near.org",
    helperUrl: "https://helper.testnet.near.org",
    explorerUrl: "https://testnet.nearblocks.io",
    name: "NEAR Testnet",
  },
  mainnet: {
    networkId: "mainnet",
    nodeUrl: "https://rpc.mainnet.near.org",
    walletUrl: "https://wallet.near.org",
    helperUrl: "https://helper.mainnet.near.org",
    explorerUrl: "https://nearblocks.io",
    name: "NEAR Mainnet",
  },
} as const;

export type Network = keyof typeof NEAR_CONFIG;

// Analytics Configuration
export const GA_TRACKING_ID = import.meta.env.VITE_GA_TRACKING_ID;

// Application URLs
export const APP_URLS = {
  base: import.meta.env.VITE_APP_URL,
  docs: import.meta.env.VITE_DOCS_URL,
  telegram: import.meta.env.VITE_TELEGRAM_URL,
} as const;

// Services
export const SERVICES = {
  avatar: import.meta.env.VITE_AVATAR_SERVICE_URL,
} as const;

// Supabase Configuration
export const SUPABASE_CONFIG = {
  url: import.meta.env.VITE_SUPABASE_URL,
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const;

// Helper function to get NearBlocks URL for transaction
export function getExplorerTxUrl(txHash: string, network: Network = 'testnet'): string {
  const base = NEAR_CONFIG[network].explorerUrl;
  return `${base}/txns/${txHash}`;
}

// Helper function to get NearBlocks URL for account
export function getExplorerAccountUrl(accountId: string, network: Network = 'testnet'): string {
  const base = NEAR_CONFIG[network].explorerUrl;
  return `${base}/address/${accountId}`;
}

// Helper function to get avatar URL
export function getAvatarUrl(seed: string): string {
  return `${SERVICES.avatar}/${seed}`;
}

// Helper function to format NEAR amount
export function formatNearAmount(amount: string): string {
  const nearAmount = parseFloat(amount) / Math.pow(10, 24);
  return nearAmount.toFixed(4);
}

// Helper function to get RPC URL with fallback to official
export function getRpcUrl(network: Network, customUrl?: string): string {
  if (customUrl) return customUrl;
  return NEAR_CONFIG[network].nodeUrl; // Fallback to official NEAR RPC
}