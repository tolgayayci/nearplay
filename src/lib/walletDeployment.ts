import { WalletSelector } from '@near-wallet-selector/core';
import { transactions } from 'near-api-js';
import BN from 'bn.js';
import { Network } from '@/contexts/WalletContext';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

// Factory contract addresses for each network
const FACTORY_CONTRACT = {
  testnet: 'factory.nearplay.testnet',
  mainnet: 'factory.nearplay-app.near',
};

// Minimum deposit required for factory deployment (covers storage + account creation)
// Factory contract requires minimum 2 NEAR
const FACTORY_DEPOSIT = '2000000000000000000000000'; // 2 NEAR

export interface WalletDeploymentResult {
  success: boolean;
  contractId: string;
  transactionHash: string;
  explorerUrl: string;
  explorerAccountUrl: string;
  network: Network;
  gasUsed?: string;
  blockHeight?: number;
  wasm_hash?: string;
}

export interface DeploymentOptions {
  selector: WalletSelector;
  userId: string;
  projectId: string;
  targetAccountId: string;
  network: Network;
  initMethodName?: string;
  initArgs?: Record<string, unknown>;
}

/**
 * Fetch compiled WASM from backend
 */
export async function fetchWasmCode(
  userId: string,
  projectId: string
): Promise<Uint8Array> {
  const url = `${BACKEND_URL}/api/wasm/${encodeURIComponent(userId)}/${encodeURIComponent(projectId)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // Try to get error details from response
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error?.message || errorMessage;
      } catch {
        const text = await response.text();
        if (text) errorMessage = text;
      }

      if (response.status === 404) {
        throw new Error('No compiled WASM found. Please compile your project first.');
      }
      throw new Error(`Failed to fetch WASM: ${errorMessage}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error('WASM file is empty. Please recompile your project.');
    }

    return new Uint8Array(arrayBuffer);
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Cannot connect to backend server. Please ensure the server is running.');
    }
    throw error;
  }
}

/**
 * Check if factory contract is deployed and available
 * @param network - The network to check (testnet or mainnet)
 * @param rpcUrl - Optional RPC URL to use (from user's RPC settings)
 */
export async function checkFactoryAvailability(network: Network, rpcUrl?: string): Promise<boolean> {
  const factoryId = FACTORY_CONTRACT[network];
  try {
    // Use provided RPC URL or fallback to defaults
    const url = rpcUrl || (network === 'mainnet'
      ? 'https://free.rpc.fastnear.com'
      : 'https://rpc.testnet.near.org');

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 'check-factory',
        method: 'query',
        params: {
          request_type: 'view_account',
          finality: 'final',
          account_id: factoryId,
        },
      }),
    });
    const data = await response.json();
    return !data.error;
  } catch {
    return false;
  }
}

/**
 * Deploy contract using factory pattern (recommended for wallet deployment)
 * This works with all wallets because it uses FunctionCall instead of DeployContract
 */
export async function deployWithFactory(
  options: DeploymentOptions
): Promise<WalletDeploymentResult> {
  const {
    selector,
    userId,
    projectId,
    network,
  } = options;

  const wallet = await selector.wallet();
  const accounts = await wallet.getAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error('No wallet account connected');
  }
  const signerAccountId = accounts[0].accountId;

  // Fetch the compiled WASM from backend
  const wasmCode = await fetchWasmCode(userId, projectId);

  // Calculate WASM hash for verification
  const hashBuffer = await crypto.subtle.digest('SHA-256', wasmCode);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const wasmHash = 'sha256:' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Generate unique contract name based on user and project
  const timestamp = Date.now();
  const shortUserId = userId.slice(0, 8);
  const shortProjectId = projectId.slice(0, 8);
  const contractName = `${shortUserId}-${shortProjectId}-${timestamp}`;

  // Factory contract address
  const factoryId = FACTORY_CONTRACT[network];

  // Call factory.deploy_contract() with FunctionCall action
  // Using NAJ format for Hot Wallet compatibility
  const args = {
    name: contractName,
    code: Array.from(wasmCode), // Convert Uint8Array to number array for JSON
  };
  const argsBuffer = Buffer.from(JSON.stringify(args));

  const result = await wallet.signAndSendTransaction({
    signerId: signerAccountId,
    receiverId: factoryId,
    actions: [
      transactions.functionCall(
        'deploy_contract',
        argsBuffer,
        new BN('300000000000000'), // 300 TGas
        new BN(FACTORY_DEPOSIT), // 3 NEAR for storage
      ),
    ],
  });

  if (!result) {
    throw new Error('Transaction was rejected or failed');
  }

  // Extract transaction info
  let transactionHash: string;
  let blockHeight: number | undefined;

  if (typeof result === 'object' && 'transaction' in result) {
    transactionHash = (result as any).transaction?.hash || (result as any).transaction_outcome?.id;
    blockHeight = (result as any).transaction_outcome?.block_height;
  } else if (typeof result === 'object' && 'transaction_outcome' in result) {
    transactionHash = (result as any).transaction_outcome?.id;
    blockHeight = (result as any).transaction_outcome?.block_height;
  } else {
    transactionHash = String(result);
  }

  // The deployed contract will be at: contractName.factory.nearplay-app.near (mainnet) or factory.nearplay.testnet (testnet)
  const deployedContractId = `${contractName}.${factoryId}`;

  const explorerBase = network === 'mainnet'
    ? 'https://nearblocks.io'
    : 'https://testnet.nearblocks.io';
  const explorerUrl = `${explorerBase}/txns/${transactionHash}`;
  const explorerAccountUrl = `${explorerBase}/address/${deployedContractId}`;

  return {
    success: true,
    contractId: deployedContractId,
    transactionHash,
    explorerUrl,
    explorerAccountUrl,
    network,
    blockHeight,
    wasm_hash: wasmHash,
  };
}

/**
 * Deploy contract using user's connected wallet
 *
 * IMPORTANT: Direct DeployContract action is NOT supported by most NEAR wallets
 * for security reasons. Wallets only expose function-call keys to web apps,
 * not full-access keys which are required for DeployContract.
 *
 * This function will attempt factory deployment if available, otherwise
 * it will throw an informative error directing users to Playground mode.
 */
export async function deployWithWallet(
  options: DeploymentOptions
): Promise<WalletDeploymentResult> {
  const { network } = options;

  // Check if factory is available
  const factoryAvailable = await checkFactoryAvailability(network);

  if (factoryAvailable) {
    // Use factory pattern - works with all wallets
    return deployWithFactory(options);
  }

  // Factory not available - explain the limitation
  throw new WalletDeploymentNotSupportedError(
    'Wallet deployment requires a factory contract that is not yet deployed. ' +
    'Please use Playground mode for now, which provides free testnet deployment. ' +
    'Factory deployment support is coming soon!'
  );
}

/**
 * Custom error class for wallet deployment limitations
 */
export class WalletDeploymentNotSupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WalletDeploymentNotSupportedError';
  }
}

/**
 * Get explorer URL for an account
 */
export function getExplorerAccountUrl(
  accountId: string,
  network: Network
): string {
  const base = network === 'mainnet'
    ? 'https://nearblocks.io'
    : 'https://testnet.nearblocks.io';
  return `${base}/address/${accountId}`;
}

/**
 * Get explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string, network: Network): string {
  const base = network === 'mainnet'
    ? 'https://nearblocks.io'
    : 'https://testnet.nearblocks.io';
  return `${base}/txns/${txHash}`;
}

/**
 * Estimate deployment gas cost using NEAR's official formula
 * Returns cost in yoctoNEAR
 *
 * NEAR Deployment Gas Formula (from docs.near.org/protocol/gas):
 * - Base: 0.58 Tgas (deploy_contract_cost)
 * - Per byte: deploy_contract_cost_per_byte
 * - Formula: 0.58 Tgas + (0.13 Tgas × contract size in KB)
 *
 * At minimum gas price (100 Ggas = 0.0001 NEAR per Tgas):
 * - 16KB contract = 2.65 Tgas ≈ 0.000265 NEAR
 * - 200KB contract = 26.58 Tgas ≈ 0.00266 NEAR
 *
 * We add receipt costs and a buffer for safety.
 */
export function estimateDeploymentCost(wasmSizeBytes: number): string {
  const wasmSizeKB = wasmSizeBytes / 1024;

  // NEAR's deployment gas formula: 0.58 Tgas + (0.13 Tgas × KB)
  const baseTgas = 0.58;
  const perKbTgas = 0.13;
  const deploymentTgas = baseTgas + (perKbTgas * wasmSizeKB);

  // Add receipt creation cost (~0.25 Tgas) and execution buffer
  const receiptTgas = 0.25;
  const totalTgas = deploymentTgas + receiptTgas;

  // Convert Tgas to NEAR at minimum gas price (1 Tgas = 0.0001 NEAR)
  // 1 Tgas = 10^12 gas units
  // Min gas price = 10^8 yoctoNEAR per gas unit
  // 1 Tgas cost = 10^12 × 10^8 = 10^20 yoctoNEAR = 0.0001 NEAR
  const tgasToYoctoNear = BigInt('100000000000000000000'); // 0.0001 NEAR in yoctoNEAR

  // Round up Tgas and multiply
  const totalTgasRounded = Math.ceil(totalTgas * 100) / 100; // Round to 2 decimals
  const costYoctoNear = BigInt(Math.ceil(totalTgasRounded * 100)) * (tgasToYoctoNear / BigInt(100));

  return costYoctoNear.toString();
}

/**
 * Format yoctoNEAR to readable NEAR amount
 */
export function formatYoctoNear(yoctoNear: string): string {
  const nearBigInt = BigInt(yoctoNear);
  const oneNear = BigInt('1000000000000000000000000');
  const wholePart = nearBigInt / oneNear;
  const fractionalPart = nearBigInt % oneNear;

  // Convert fractional part to string with leading zeros
  const fractionalStr = fractionalPart.toString().padStart(24, '0');

  // Take first 4 decimal places
  const decimals = fractionalStr.slice(0, 4);

  return `${wholePart}.${decimals}`;
}
