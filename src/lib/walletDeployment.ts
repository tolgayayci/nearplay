import { WalletSelector } from '@near-wallet-selector/core';
import { Network } from '@/contexts/WalletContext';

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface WalletDeploymentResult {
  success: boolean;
  contractId: string;
  transactionHash: string;
  explorerUrl: string;
  gasUsed?: string;
  blockHeight?: number;
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
 * Deploy contract using user's connected wallet
 */
export async function deployWithWallet(
  options: DeploymentOptions
): Promise<WalletDeploymentResult> {
  const {
    selector,
    userId,
    projectId,
    targetAccountId,
    network,
    initMethodName,
    initArgs,
  } = options;

  // Get the active wallet
  const wallet = await selector.wallet();

  // Fetch the compiled WASM from backend
  const wasmCode = await fetchWasmCode(userId, projectId);

  // Build actions array - try borsh struct format
  const actions: Array<Record<string, unknown>> = [
    {
      deployContract: {
        code: wasmCode,
      },
    },
  ];

  // Optionally add init method call
  if (initMethodName) {
    actions.push({
      functionCall: {
        methodName: initMethodName,
        args: initArgs || {},
        gas: '30000000000000', // 30 TGas
        deposit: '0',
      },
    });
  }

  // Sign and send transaction
  const result = await wallet.signAndSendTransaction({
    receiverId: targetAccountId,
    actions,
  });

  // Handle result
  if (!result) {
    throw new Error('Transaction was rejected or failed');
  }

  // Extract transaction info from result
  // The result structure varies by wallet, handle both cases
  let transactionHash: string;
  let blockHeight: number | undefined;

  if (typeof result === 'object' && 'transaction' in result) {
    transactionHash = (result as any).transaction?.hash || (result as any).transaction_outcome?.id;
    blockHeight = (result as any).transaction_outcome?.block_height;
  } else if (typeof result === 'object' && 'transaction_outcome' in result) {
    transactionHash = (result as any).transaction_outcome?.id;
    blockHeight = (result as any).transaction_outcome?.block_height;
  } else {
    // Fallback - assume result is the hash
    transactionHash = String(result);
  }

  // Build explorer URL
  const explorerBase = network === 'mainnet'
    ? 'https://nearblocks.io'
    : 'https://testnet.nearblocks.io';
  const explorerUrl = `${explorerBase}/txns/${transactionHash}`;

  return {
    success: true,
    contractId: targetAccountId,
    transactionHash,
    explorerUrl,
    blockHeight,
  };
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
 * Estimate deployment cost
 * Returns cost in yoctoNEAR
 */
export function estimateDeploymentCost(wasmSizeBytes: number): string {
  // Storage cost: ~1 NEAR per 100KB
  // Base transaction cost: ~0.0001 NEAR
  // Contract deployment action: ~0.001 NEAR
  const storageCost = BigInt(wasmSizeBytes) * BigInt('10000000000000000000'); // 0.00001 NEAR per byte
  const baseCost = BigInt('100000000000000000000000'); // 0.0001 NEAR
  const deployActionCost = BigInt('1000000000000000000000000'); // 0.001 NEAR

  return (storageCost + baseCost + deployActionCost).toString();
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
