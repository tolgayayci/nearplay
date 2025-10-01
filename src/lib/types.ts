export interface User {
  id: string;
  email: string;
  name?: string;
  company?: string;
  bio?: string;
  avatar_url?: string;
  created_at: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  code: string;
  created_at: string;
  updated_at: string;
  last_compilation?: CompilationResult;
  metadata?: Record<string, any>;
  last_activity_at?: string;
  is_public?: boolean;
  shared_at?: string;
  view_count?: number;
  deployment_count?: number;
}

export interface CompilationResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  details: {
    status: string;
    compilation_time: number;
    project_path: string;
    wasm_size?: number;
    optimized?: boolean;
  };
  abi: any[];
  code_snapshot: string;
}

export interface DeploymentResult {
  success: boolean;
  transaction_hash: string;
  contract_id: string;
  explorer_url: string;
  gas_used?: string;
  details: {
    network: string;
    block_height: number;
    timestamp: string;
    deployer_account: string;
  };
}

export interface Deployment {
  id: string;
  project_id: string;
  contract_address: string;
  chain_id: string;
  chain_name: string;
  deployed_code: string;
  abi: any[];
  metadata: Record<string, any>;
  created_at: string;
}

export interface ABIMethod {
  name: string;
  kind: 'view' | 'call';
  modifiers?: string[];
  doc?: string;
  params?: {
    serialization_type: string;
    args: Array<{
      name: string;
      type_schema: any;
    }>;
  };
  result?: {
    serialization_type: string;
    type_schema: any;
  };
  // Additional fields for UI rendering
  type?: string;
  stateMutability?: string;
  inputs?: Array<{
    name: string;
    type: string;
    internalType: string;
  }>;
  outputs?: Array<{
    name: string;
    type: string;
    internalType: string;
  }>;
}

export interface MethodCallResult {
  success: boolean;
  result?: any;
  transaction_hash?: string;
  logs: string[];
  gas_used?: string;
  error?: string;
}