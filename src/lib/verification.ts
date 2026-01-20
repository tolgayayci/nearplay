/**
 * Verification API utilities for contract source verification
 */

const BACKEND_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';

export interface ProjectMetadata {
  name: string;
  version: string;
  rust_version: string | null;
  source_files: string[];
  build_command: string;
}

export interface VerificationPackage {
  zip_base64: string;
  file_count: number;
  total_size: number;
}

export interface VerificationSubmission {
  contract_id: string;
  network: 'testnet' | 'mainnet';
  name: string;
  version: string;
  description: string;
  license: string;
  repository_url?: string;
  build_command: string;
  source_package: string; // base64 encoded zip
}

export interface VerificationResult {
  success: boolean;
  verification_id?: string;
  status: 'pending' | 'verified' | 'failed';
  message?: string;
  verification_url?: string;
}

export interface VerificationStatus {
  verified: boolean;
  verification_date?: string;
  source_code_hash?: string;
  verification_url?: string;
}

export interface PublishResult {
  repo_url: string;
  repo_name: string;
}

export interface VerifyContractResult {
  verified: boolean;
  compiled_hash: string;
  onchain_hash: string;
  verified_at?: string;
}

/**
 * Get project metadata for verification
 */
export async function getProjectMetadata(
  userId: string,
  projectId: string
): Promise<ProjectMetadata> {
  const response = await fetch(`${BACKEND_URL}/api/verification/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, project_id: projectId }),
  });

  if (!response.ok) {
    throw new Error('Failed to get project metadata');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to get project metadata');
  }

  return result.data;
}

/**
 * Package project source for verification
 */
export async function packageSource(
  userId: string,
  projectId: string
): Promise<VerificationPackage> {
  const response = await fetch(`${BACKEND_URL}/api/verification/package`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, project_id: projectId }),
  });

  if (!response.ok) {
    throw new Error('Failed to package source');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to package source');
  }

  return result.data;
}

/**
 * Publish source code to GitHub for verification
 */
export async function publishSource(
  userId: string,
  projectId: string,
  contractId: string
): Promise<PublishResult> {
  const response = await fetch(`${BACKEND_URL}/api/source/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      project_id: projectId,
      contract_id: contractId,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to publish source');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to publish source');
  }

  return result.data;
}

/**
 * Check if a contract is verified through NEAR Playground
 * Uses our backend database to check verification status
 */
export async function checkVerificationStatus(
  contractId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<VerificationStatus> {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/verification/status?contract_id=${encodeURIComponent(contractId)}&network=${network}`
    );

    if (!response.ok) {
      return { verified: false };
    }

    const result = await response.json();

    return {
      verified: result.data?.verified || false,
      verification_date: result.data?.verification_date,
    };
  } catch {
    // API error, assume not verified
    return { verified: false };
  }
}

/**
 * Get the on-chain bytecode hash for a contract
 * Backend fetches the deployed bytecode and returns its hash
 */
export async function getOnchainHash(
  contractId: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<string> {
  const response = await fetch(`${BACKEND_URL}/api/verification/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contract_id: contractId,
      network,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to fetch on-chain bytecode');
  }

  const result = await response.json();
  if (!result.success) {
    throw new Error(result.error?.message || result.message || 'Failed to fetch on-chain bytecode');
  }

  return result.data.onchain_hash;
}

/**
 * Verify a contract by comparing stored WASM hash with on-chain bytecode
 * compiledHash: The wasm_hash stored during deployment
 */
export async function verifyContract(
  contractId: string,
  compiledHash: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<VerifyContractResult> {
  // Get on-chain hash from backend
  const onchainHash = await getOnchainHash(contractId, network);

  // Compare hashes
  const verified = compiledHash === onchainHash;

  return {
    verified,
    compiled_hash: compiledHash,
    onchain_hash: onchainHash,
    verified_at: verified ? new Date().toISOString() : undefined,
  };
}

/**
 * Get the Nearblocks verification URL for a contract
 * This embeds the SourceScan verifier for NEP-330 verification
 */
export function getVerificationUrl(contractId: string, network: 'testnet' | 'mainnet'): string {
  const verifier = network === 'mainnet'
    ? 'v2-verifier.sourcescan.near'
    : 'v2-verifier.sourcescan.testnet';
  const base = network === 'mainnet'
    ? 'https://nearblocks.io'
    : 'https://testnet.nearblocks.io';
  return `${base}/verify-contract?accountId=${contractId}&selectedVerifier=${verifier}`;
}

/**
 * Submit contract for verification
 * Returns the Nearblocks verification URL for iframe embedding
 */
export async function submitVerification(
  submission: VerificationSubmission
): Promise<VerificationResult> {
  return {
    success: true,
    status: 'pending',
    message: 'Complete verification in the Nearblocks window',
    verification_url: getVerificationUrl(submission.contract_id, submission.network),
  };
}

/**
 * Get the explorer URL for a contract
 */
export function getExplorerUrl(contractId: string, network: 'testnet' | 'mainnet'): string {
  return network === 'mainnet'
    ? `https://nearblocks.io/address/${contractId}`
    : `https://testnet.nearblocks.io/address/${contractId}`;
}

/**
 * License options for verification
 */
export const LICENSE_OPTIONS = [
  { value: 'MIT', label: 'MIT License' },
  { value: 'Apache-2.0', label: 'Apache License 2.0' },
  { value: 'GPL-3.0', label: 'GNU GPLv3' },
  { value: 'BSD-3-Clause', label: 'BSD 3-Clause' },
  { value: 'UNLICENSED', label: 'Unlicensed / Proprietary' },
  { value: 'OTHER', label: 'Other' },
];
