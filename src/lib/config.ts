// API Configuration
export const API_URL = import.meta.env.VITE_API_URL;

// NEAR Network Configuration
export const NEAR_CONFIG = {
  testnet: {
    networkId: import.meta.env.VITE_NEAR_NETWORK || "testnet",
    nodeUrl: import.meta.env.VITE_NEAR_NODE_URL || "https://rpc.testnet.near.org",
    walletUrl: import.meta.env.VITE_NEAR_WALLET_URL || "https://wallet.testnet.near.org",
    helperUrl: import.meta.env.VITE_NEAR_HELPER_URL || "https://helper.testnet.near.org",
    explorerUrl: import.meta.env.VITE_NEAR_EXPLORER_URL || "https://explorer.testnet.near.org",
    name: "NEAR Testnet",
  },
} as const;

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
export function getExplorerTxUrl(txHash: string): string {
  return `https://testnet.nearblocks.io/txns/${txHash}`;
}

// Helper function to get NearBlocks URL for account
export function getExplorerAccountUrl(accountId: string): string {
  return `https://testnet.nearblocks.io/address/${accountId}`;
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