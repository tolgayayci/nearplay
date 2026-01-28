import { callContractMethod } from './api';
import { ABIMethod } from './types';
import { WalletSelector } from '@near-wallet-selector/core';
import { transactions } from 'near-api-js';
import BN from 'bn.js';

// Parse NEAR-specific types
export function parseNearValue(value: string, type: string): any {
  // Handle basic types
  switch (type) {
    case 'string':
    case 'String':
      return value;
    case 'u8':
    case 'u16':
    case 'u32':
    case 'u64':
    case 'u128':
    case 'i8':
    case 'i16':
    case 'i32':
    case 'i64':
    case 'i128':
    case 'int8':
    case 'int16':
    case 'int32':
    case 'int64':
    case 'uint8':
    case 'uint16':
    case 'uint32':
    case 'uint64':
      // Return as number for proper JSON serialization
      const num = parseInt(value, 10);
      return isNaN(num) ? 0 : num;
    case 'bool':
    case 'Boolean':
      return value === 'true' || value === '1';
    case 'AccountId':
      return value; // NEAR account IDs are strings
    case 'object':
      // Try to parse as JSON for complex types
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    default:
      // For any other type, try to parse as JSON first, fallback to string
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
  }
}

// Check if a NEAR result contains execution errors
function hasExecutionError(result: any): boolean {
  if (!result) return false;

  // Check for ActionError in result
  if (result.ActionError || (Array.isArray(result) && result.some(r => r.ActionError))) {
    return true;
  }

  // Check for common error patterns in the result
  if (typeof result === 'string' && result.includes('panicked')) {
    return true;
  }

  return false;
}

// Comprehensive check for NEAR execution errors
function checkForNearExecutionErrors(result: any): boolean {
  if (!result) return false;

  // Check direct ActionError
  if (result.ActionError) return true;

  // Check if it's an array with ActionError items
  if (Array.isArray(result)) {
    return result.some((r: any) => r.ActionError);
  }

  // Check for string errors (e.g., panicked)
  if (typeof result === 'string' && result.includes('panicked')) return true;

  // Check for nested ActionError in object structure
  if (typeof result === 'object') {
    // Check if it's wrapped in another layer
    if (result.result?.ActionError) return true;
    if (result.error?.ActionError) return true;

    // Deep search for ActionError in any property
    for (const value of Object.values(result)) {
      if (value && typeof value === 'object') {
        if (value.ActionError) return true;
        if (Array.isArray(value) && value.some((v: any) => v.ActionError)) return true;
      }
    }
  }

  return false;
}

// Extract error message from NEAR execution error
function extractNearError(result: any): string {
  if (!result) return 'Unknown error';

  // Handle ActionError format
  if (result.ActionError) {
    const actionError = result.ActionError;
    if (actionError.kind?.FunctionCallError?.ExecutionError) {
      return actionError.kind.FunctionCallError.ExecutionError;
    }
    return JSON.stringify(actionError, null, 2);
  }

  // Handle array of errors
  if (Array.isArray(result)) {
    const errorItem = result.find(r => r.ActionError);
    if (errorItem) {
      return extractNearError(errorItem);
    }
  }

  // Handle string errors
  if (typeof result === 'string') {
    return result;
  }

  // Return raw error object
  return JSON.stringify(result, null, 2);
}

// Execute a NEAR contract method
export async function executeNearMethod(
  contractAddress: string,
  method: ABIMethod,
  inputs: Record<string, string>,
  rpcUrl?: string
): Promise<{
  success: boolean;
  result?: any;
  transactionHash?: string;
  logs?: string[];
  gasUsed?: string;
  error?: string;
  rawResponse?: any;
}> {
  try {
    // Prepare arguments based on method inputs
    const args: Record<string, any> = {};

    if (method.inputs && method.inputs.length > 0) {
      for (const input of method.inputs) {
        const value = inputs[input.name];
        if (value !== undefined && value !== '') {
          args[input.name] = parseNearValue(value, input.type);
        }
      }
    }

    // Determine method type based on stateMutability or custom NEAR metadata
    const methodType = (method.stateMutability === 'view' || method.stateMutability === 'pure')
      ? 'view'
      : 'call';

    // Call the backend API with optional RPC URL
    const response = await callContractMethod(
      contractAddress,
      method.name,
      args,
      methodType,
      rpcUrl
    );

    // Extract the actual result from the new backend format
    let actualResult = response.result;

    // Handle new backend format with nested result structure
    if (response.result && typeof response.result === 'object') {
      // For view methods, backend returns {result: value, logs: [], raw: base64}
      if ('result' in response.result && 'raw' in response.result) {
        actualResult = response.result.result;
      }
      // For change methods, backend returns full transaction details
      else if ('status' in response.result) {
        actualResult = response.result;
      }
    }

    // Always check for NEAR execution errors in the result, regardless of backend success flag
    const hasExecutionError = checkForNearExecutionErrors(actualResult);

    if (hasExecutionError) {
      return {
        success: false,
        error: extractNearError(actualResult),
        result: actualResult, // Include raw result even for errors
        transactionHash: response.transaction_hash,
        gasUsed: response.gas_used,
        rawResponse: response,
      };
    }

    // If backend says error but no execution error, still treat as error
    if (!response.success) {
      return {
        success: false,
        error: response.error || 'Transaction failed',
        result: response.result, // Include raw result
        transactionHash: response.transaction_hash,
        gasUsed: response.gas_used,
        rawResponse: response,
      };
    }

    return {
      success: true,
      result: actualResult, // Return the extracted result
      transactionHash: response.transaction_hash,
      logs: response.logs,
      gasUsed: response.gas_used,
      rawResponse: response,
    };
  } catch (error) {
    console.error('Error executing NEAR method:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute method',
    };
  }
}

// Get method type label for display
export function getMethodTypeLabel(method: ABIMethod): string {
  if (method.type === 'constructor') return 'Constructor';
  if (method.type === 'event') return 'Event';
  if (method.type === 'error') return 'Error';
  
  if (method.type === 'function') {
    if (method.stateMutability === 'view' || method.stateMutability === 'pure') {
      return 'View';
    }
    if (method.stateMutability === 'payable') {
      return 'Payable';
    }
    return 'Call';
  }
  
  return 'Function';
}

// Check if method is executable
export function isMethodExecutable(method: ABIMethod): boolean {
  return method.type === 'function';
}

// Execute a change method using the connected wallet (for mainnet)
export async function executeChangeMethodWithWallet(
  selector: WalletSelector,
  contractAddress: string,
  methodName: string,
  args: Record<string, unknown>,
  deposit?: string,
  gas?: string
): Promise<{
  success: boolean;
  result?: any;
  transactionHash?: string;
  logs?: string[];
  error?: string;
}> {
  try {
    const wallet = await selector.wallet();
    const accounts = await wallet.getAccounts();

    if (!accounts.length) {
      throw new Error('No wallet account connected');
    }

    const signerAccountId = accounts[0].accountId;

    // Convert args to Buffer for the function call
    const argsBuffer = Buffer.from(JSON.stringify(args));

    // Use NAJ format for better wallet compatibility
    const result = await wallet.signAndSendTransaction({
      signerId: signerAccountId,
      receiverId: contractAddress,
      actions: [
        transactions.functionCall(
          methodName,
          argsBuffer,
          new BN(gas || '30000000000000'), // 30 TGas default
          new BN(deposit || '0'),
        ),
      ],
    });

    if (!result) {
      throw new Error('Transaction was rejected or failed');
    }

    // Extract transaction info
    let transactionHash: string | undefined;
    let logs: string[] = [];
    let returnValue: any = null;

    if (typeof result === 'object') {
      // Extract transaction hash
      if ('transaction' in result) {
        transactionHash = (result as any).transaction?.hash || (result as any).transaction_outcome?.id;
      } else if ('transaction_outcome' in result) {
        transactionHash = (result as any).transaction_outcome?.id;
      }

      // Extract logs from receipts
      if ('receipts_outcome' in result) {
        const receiptsOutcome = (result as any).receipts_outcome;
        if (Array.isArray(receiptsOutcome)) {
          for (const receipt of receiptsOutcome) {
            if (receipt.outcome?.logs) {
              logs.push(...receipt.outcome.logs);
            }
          }
        }
      }

      // Extract return value from status
      if ('status' in result) {
        const status = (result as any).status;
        if (status?.SuccessValue) {
          try {
            // SuccessValue is base64 encoded
            const decoded = atob(status.SuccessValue);
            returnValue = decoded ? JSON.parse(decoded) : null;
          } catch {
            returnValue = status.SuccessValue;
          }
        } else if (status?.Failure) {
          return {
            success: false,
            error: JSON.stringify(status.Failure, null, 2),
            transactionHash,
            logs,
          };
        }
      }

      // Check for final execution status
      if ('final_execution_status' in result) {
        const finalStatus = (result as any).final_execution_status;
        if (finalStatus === 'FINAL' || finalStatus === 'EXECUTED') {
          // Transaction succeeded
        } else if (typeof finalStatus === 'object' && finalStatus.Failure) {
          return {
            success: false,
            error: JSON.stringify(finalStatus.Failure, null, 2),
            transactionHash,
            logs,
          };
        }
      }
    } else {
      transactionHash = String(result);
    }

    return {
      success: true,
      result: returnValue,
      transactionHash,
      logs,
    };
  } catch (error) {
    console.error('Wallet execution error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute method with wallet',
    };
  }
}