import axios from 'axios';
import { CompilationResult, DeploymentResult, MethodCallResult, FileNode, FileContent, CrateSearchResponse, CrateVersionsResponse, CrateInfo, CrateVersion, FaucetStatusResponse, FaucetRequestResponse, FaucetHistoryItem } from './types';
import { API_URL } from './config';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${import.meta.env.VITE_API_KEY}`
  },
});

interface CompileRequest {
  user_id: string;
  project_id: string;
  code: string;
}

interface DeployRequest {
  user_id: string;
  project_id: string;
  rpc_url?: string;
}

interface MethodCallRequest {
  contract_address: string;
  method_name: string;
  args: any;
  method_type: 'view' | 'call';
  rpc_url?: string;
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
  error: {
    code: string;
    message: string;
    details: string | null;
  } | null;
}

interface CompileResponse {
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
  abi: any | null;
}

/**
 * Compile a NEAR smart contract
 */
export async function compileContract(
  code: string,
  userId: string,
  projectId: string
): Promise<CompilationResult> {
  try {
    const payload: CompileRequest = {
      user_id: userId,
      project_id: projectId,
      code,
    };

    const { data: response } = await api.post<ApiResponse<CompileResponse>>('/compile', payload);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Compilation failed');
    }

    return {
      success: response.data.success,
      exit_code: response.data.exit_code,
      stdout: response.data.stdout,
      stderr: response.data.stderr,
      details: {
        status: response.data.details.status,
        compilation_time: response.data.details.compilation_time,
        project_path: response.data.details.project_path,
        wasm_size: response.data.details.wasm_size,
        optimized: response.data.details.optimized,
      },
      abi: response.data.abi || [],
      code_snapshot: code,
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to compile contract');
    }
    throw error instanceof Error 
      ? error 
      : new Error('Failed to compile contract');
  }
}

/**
 * Deploy a compiled contract to NEAR Testnet
 */
export async function deployContract(
  userId: string,
  projectId: string,
  rpcUrl?: string
): Promise<DeploymentResult> {
  try {
    const payload: DeployRequest = {
      user_id: userId,
      project_id: projectId,
      rpc_url: rpcUrl,
    };

    const { data: response } = await api.post<ApiResponse<DeploymentResult>>('/deploy', payload);

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Deployment failed');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to deploy contract');
    }
    throw error instanceof Error 
      ? error 
      : new Error('Failed to deploy contract');
  }
}

/**
 * Call a method on a deployed NEAR contract
 */
export async function callContractMethod(
  contractAddress: string,
  methodName: string,
  args: any,
  methodType: 'view' | 'call',
  rpcUrl?: string
): Promise<MethodCallResult> {
  try {
    const payload: MethodCallRequest = {
      contract_address: contractAddress,
      method_name: methodName,
      args,
      method_type: methodType,
      rpc_url: rpcUrl,
    };

    const { data: response } = await api.post<ApiResponse<MethodCallResult>>('/method-call', payload);

    // Always return the data, even if backend marks it as "failed"
    // Let the frontend handle error detection from the actual result
    if (response.data) {
      return response.data;
    }

    // If no data but we have an error response, create a MethodCallResult with the error
    return {
      success: false,
      error: response.error?.message || 'Method call failed',
      logs: [],
    };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;

      // If we have data in the error response, return it
      if (apiError.data) {
        return apiError.data;
      }

      // Otherwise create an error result
      return {
        success: false,
        error: apiError.error?.message || 'Failed to call contract method',
        logs: [],
      };
    }

    // Network or other errors
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to call contract method',
      logs: [],
    };
  }
}

// ============================================
// Filesystem API
// ============================================

/**
 * Initialize a project's filesystem (creates from base_project template)
 * If code is provided, it will be written to src/lib.rs
 */
export async function initializeProject(
  userId: string,
  projectId: string,
  code?: string
): Promise<void> {
  try {
    const { data: response } = await api.post<ApiResponse<any>>('/api/project/initialize', {
      user_id: userId,
      project_id: projectId,
      code,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to initialize project');
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to initialize project');
    }
    throw error instanceof Error ? error : new Error('Failed to initialize project');
  }
}

/**
 * Get the file tree for a project
 */
export async function getFileTree(
  userId: string,
  projectId: string
): Promise<FileNode> {
  try {
    const { data: response } = await api.get<ApiResponse<FileNode>>('/api/filesystem/tree', {
      params: { user_id: userId, project_id: projectId },
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get file tree');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to get file tree');
    }
    throw error instanceof Error ? error : new Error('Failed to get file tree');
  }
}

/**
 * Read a file's content
 */
export async function readFile(
  userId: string,
  projectId: string,
  path: string
): Promise<FileContent> {
  try {
    const { data: response } = await api.post<ApiResponse<FileContent>>('/api/filesystem/read', {
      user_id: userId,
      project_id: projectId,
      path,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to read file');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to read file');
    }
    throw error instanceof Error ? error : new Error('Failed to read file');
  }
}

/**
 * Write content to a file
 */
export async function writeFile(
  userId: string,
  projectId: string,
  path: string,
  content: string
): Promise<FileContent> {
  try {
    const { data: response } = await api.post<ApiResponse<FileContent>>('/api/filesystem/write', {
      user_id: userId,
      project_id: projectId,
      path,
      content,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to write file');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to write file');
    }
    throw error instanceof Error ? error : new Error('Failed to write file');
  }
}

/**
 * Create a new file
 */
export async function createFile(
  userId: string,
  projectId: string,
  path: string
): Promise<FileContent> {
  try {
    const { data: response } = await api.post<ApiResponse<FileContent>>('/api/filesystem/create', {
      user_id: userId,
      project_id: projectId,
      path,
      is_directory: false,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to create file');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to create file');
    }
    throw error instanceof Error ? error : new Error('Failed to create file');
  }
}

/**
 * Create a new directory
 */
export async function createDirectory(
  userId: string,
  projectId: string,
  path: string
): Promise<void> {
  try {
    const { data: response } = await api.post<ApiResponse<any>>('/api/filesystem/mkdir', {
      user_id: userId,
      project_id: projectId,
      path,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to create directory');
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to create directory');
    }
    throw error instanceof Error ? error : new Error('Failed to create directory');
  }
}

/**
 * Delete a file or directory
 */
export async function deleteFile(
  userId: string,
  projectId: string,
  path: string
): Promise<void> {
  try {
    const { data: response } = await api.post<ApiResponse<any>>('/api/filesystem/delete', {
      user_id: userId,
      project_id: projectId,
      path,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to delete file');
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to delete file');
    }
    throw error instanceof Error ? error : new Error('Failed to delete file');
  }
}

/**
 * Rename a file or directory
 */
export async function renameFile(
  userId: string,
  projectId: string,
  oldPath: string,
  newPath: string
): Promise<void> {
  try {
    const { data: response } = await api.post<ApiResponse<any>>('/api/filesystem/rename', {
      user_id: userId,
      project_id: projectId,
      old_path: oldPath,
      new_path: newPath,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to rename file');
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to rename file');
    }
    throw error instanceof Error ? error : new Error('Failed to rename file');
  }
}

/**
 * Move a file or directory
 */
export async function moveFile(
  userId: string,
  projectId: string,
  sourcePath: string,
  destinationPath: string
): Promise<void> {
  try {
    const { data: response } = await api.post<ApiResponse<any>>('/api/filesystem/move', {
      user_id: userId,
      project_id: projectId,
      source_path: sourcePath,
      destination_path: destinationPath,
    });

    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to move file');
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to move file');
    }
    throw error instanceof Error ? error : new Error('Failed to move file');
  }
}

/**
 * Search files in project by filename or content
 */
export async function searchFiles(
  userId: string,
  projectId: string,
  query: string,
  searchContent: boolean = false
): Promise<{ path: string; name: string; preview?: string; line_number?: number }[]> {
  try {
    const { data: response } = await api.post<ApiResponse<{
      results: { path: string; name: string; preview?: string; line_number?: number }[];
      total_matches: number;
    }>>('/api/filesystem/search', {
      user_id: userId,
      project_id: projectId,
      query,
      search_content: searchContent,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Search failed');
    }

    return response.data.results;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to search files');
    }
    throw error instanceof Error ? error : new Error('Failed to search files');
  }
}

// ============================================
// Project Export API
// ============================================

/**
 * Export a project as a ZIP file
 * Downloads the project files (excluding target/ and .git/)
 */
export async function exportProject(
  userId: string,
  projectId: string,
  projectName: string
): Promise<void> {
  try {
    const response = await api.get(`/api/project/export/${userId}/${projectId}`, {
      responseType: 'blob',
    });

    // Create download link
    const blob = new Blob([response.data], { type: 'application/zip' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      // Try to parse error response if it's JSON
      try {
        const text = await (error.response.data as Blob).text();
        const apiError = JSON.parse(text) as ApiResponse<any>;
        throw new Error(apiError.error?.message || 'Failed to export project');
      } catch {
        throw new Error('Failed to export project');
      }
    }
    throw error instanceof Error ? error : new Error('Failed to export project');
  }
}

// ============================================
// Crates.io API
// ============================================

// Use proxy in development to avoid CORS, direct URL in production
const CRATES_IO_API = import.meta.env.DEV ? '/crates-api' : 'https://crates.io/api/v1';

/**
 * Search for crates on crates.io
 */
export async function searchCrates(
  query: string,
  page: number = 1,
  perPage: number = 10
): Promise<CrateSearchResponse> {
  try {
    const response = await axios.get<CrateSearchResponse>(
      `${CRATES_IO_API}/crates`,
      {
        params: {
          q: query,
          page,
          per_page: perPage,
        },
        headers: {
          'User-Agent': 'nearplay/1.0 (https://nearplay.app)',
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Failed to search crates:', error);
    throw error instanceof Error ? error : new Error('Failed to search crates');
  }
}

/**
 * Get versions for a specific crate
 */
export async function getCrateVersions(
  crateName: string
): Promise<CrateVersion[]> {
  try {
    const response = await axios.get<CrateVersionsResponse>(
      `${CRATES_IO_API}/crates/${crateName}/versions`,
      {
        headers: {
          'User-Agent': 'nearplay/1.0 (https://nearplay.app)',
        },
      }
    );
    return response.data.versions;
  } catch (error) {
    console.error('Failed to get crate versions:', error);
    throw error instanceof Error ? error : new Error('Failed to get crate versions');
  }
}

/**
 * Get crate details
 */
export async function getCrateDetails(
  crateName: string
): Promise<CrateInfo> {
  try {
    const response = await axios.get<{ crate: CrateInfo }>(
      `${CRATES_IO_API}/crates/${crateName}`,
      {
        headers: {
          'User-Agent': 'nearplay/1.0 (https://nearplay.app)',
        },
      }
    );
    return response.data.crate;
  } catch (error) {
    console.error('Failed to get crate details:', error);
    throw error instanceof Error ? error : new Error('Failed to get crate details');
  }
}

// ============================================
// Faucet API
// ============================================

/**
 * Get faucet status for a user (rate limit info, balance)
 */
export async function getFaucetStatus(userId: string): Promise<FaucetStatusResponse> {
  try {
    const { data: response } = await api.get<ApiResponse<FaucetStatusResponse>>(
      '/api/faucet/status',
      { params: { user_id: userId } }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Failed to get faucet status');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      throw new Error(apiError.error?.message || 'Failed to get faucet status');
    }
    throw error instanceof Error ? error : new Error('Failed to get faucet status');
  }
}

/**
 * Request tokens from the faucet
 */
export async function requestFaucet(
  userId: string,
  recipientAccount: string
): Promise<FaucetRequestResponse> {
  try {
    const { data: response } = await api.post<ApiResponse<FaucetRequestResponse>>(
      '/api/faucet/request',
      {
        user_id: userId,
        recipient_account: recipientAccount,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error?.message || 'Faucet request failed');
    }

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const apiError = error.response.data as ApiResponse<any>;
      // Return error response instead of throwing
      return {
        success: false,
        error: apiError.error?.message || 'Faucet request failed',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Faucet request failed',
    };
  }
}

/**
 * Get faucet request history for a user
 */
export async function getFaucetHistory(
  userId: string,
  limit: number = 3
): Promise<FaucetHistoryItem[]> {
  try {
    const { data: response } = await api.get<ApiResponse<FaucetHistoryItem[]>>(
      '/api/faucet/history',
      { params: { user_id: userId, limit } }
    );

    if (!response.success || !response.data) {
      return [];
    }

    return response.data;
  } catch (error) {
    console.error('Failed to fetch faucet history:', error);
    return [];
  }
}