import { supabase } from './supabase';
import { API_URL } from './config';

// GitHub URL validation patterns - flexible to handle trailing slashes, /tree/main, .git suffix, etc.
const GITHUB_URL_PATTERNS = [
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
  /^github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
  /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/,
  /^https?:\/\/www\.github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/.*)?$/,
];

// NEAR SDK dependency patterns to check in Cargo.toml
const NEAR_DEPENDENCIES = [
  'near-sdk',
  'near_sdk',
  'near-contract-standards',
  'near_contract_standards',
];

export interface GitHubRepo {
  owner: string;
  repo: string;
  url: string;
  branch?: string;
  path?: string;
}

export interface RepoInfo {
  exists: boolean;
  isPublic: boolean;
  name: string;
  description: string | null;
  defaultBranch: string;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface ImportResult {
  success: boolean;
  projectId?: string;
  error?: string;
  filesCount?: number;
}

/**
 * Validates if a string is a valid GitHub URL format
 */
export function validateGitHubUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // Try main patterns first
  if (GITHUB_URL_PATTERNS.some(pattern => pattern.test(trimmed))) {
    return true;
  }

  // Fallback: accept any URL that contains github.com with owner/repo structure
  return /github\.com[/:]([^/]+)\/([^/?#\s]+)/i.test(trimmed);
}

/**
 * Parses a GitHub URL and extracts owner, repo, branch, and path
 * Supports URLs like:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo/tree/main
 * - https://github.com/owner/repo/tree/main/path/to/subdir
 */
export function parseGitHubUrl(url: string): GitHubRepo | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Pattern to match GitHub URLs with optional tree/branch/path
  // Groups: 1=owner, 2=repo, 3=branch (optional), 4=path (optional)
  const treePattern = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/([^/]+)(?:\/(.+))?)?(?:\?.*)?$/i;
  const match = trimmed.match(treePattern);

  if (match) {
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');
    const branch = match[3] || undefined;
    const path = match[4] || undefined;

    return {
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
      branch,
      path,
    };
  }

  // Fallback for simpler URLs
  const simpleMatch = trimmed.match(/github\.com[/:]([^/]+)\/([^/?#\s]+)/i);
  if (simpleMatch) {
    const owner = simpleMatch[1];
    const repo = simpleMatch[2].replace(/\.git$/, '').replace(/\/$/, '');
    return {
      owner,
      repo,
      url: `https://github.com/${owner}/${repo}`,
    };
  }

  return null;
}

/**
 * Checks if a GitHub repository exists and is accessible
 */
export async function checkGitHubRepository(owner: string, repo: string): Promise<RepoInfo> {
  try {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 404) {
      return {
        exists: false,
        isPublic: false,
        name: '',
        description: null,
        defaultBranch: 'main',
      };
    }

    if (response.status === 403) {
      // Could be private or rate limited
      return {
        exists: true,
        isPublic: false,
        name: repo,
        description: null,
        defaultBranch: 'main',
      };
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return {
      exists: true,
      isPublic: !data.private,
      name: data.name,
      description: data.description,
      defaultBranch: data.default_branch || 'main',
    };
  } catch (error) {
    console.error('Error checking GitHub repository:', error);
    throw error;
  }
}

/**
 * Validates if a repository contains a valid NEAR project
 * Checks for near-sdk or related dependencies in Cargo.toml
 * Supports checking subdirectories via the path parameter
 */
export async function validateNearProject(
  owner: string,
  repo: string,
  branch?: string,
  path?: string
): Promise<ValidationResult> {
  try {
    // Build the path to Cargo.toml
    const cargoPath = path ? `${path}/Cargo.toml` : 'Cargo.toml';
    const ref = branch ? `?ref=${branch}` : '';

    // Fetch Cargo.toml from the repository (or subdirectory)
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${cargoPath}${ref}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (response.status === 404) {
      const location = path ? `in "${path}"` : 'in the repository root';
      return {
        isValid: false,
        reason: `No Cargo.toml found ${location}. This does not appear to be a Rust project.`,
      };
    }

    if (!response.ok) {
      return {
        isValid: false,
        reason: `Unable to check Cargo.toml: ${response.status}`,
      };
    }

    const data = await response.json();

    // Decode base64 content
    const content = atob(data.content.replace(/\n/g, ''));

    // Check for NEAR dependencies
    const hasNearDependency = NEAR_DEPENDENCIES.some(dep =>
      content.includes(dep)
    );

    if (!hasNearDependency) {
      return {
        isValid: false,
        reason: 'No NEAR SDK dependencies found. This does not appear to be a NEAR smart contract project.',
      };
    }

    return {
      isValid: true,
    };
  } catch (error) {
    console.error('Error validating NEAR project:', error);
    return {
      isValid: false,
      reason: 'Failed to validate project structure.',
    };
  }
}

/**
 * Suggests a valid project name from a repository name or subdirectory path
 */
export function suggestProjectName(repoName: string, path?: string): string {
  // If a path is provided, use the last part of the path as the name
  const baseName = path ? path.split('/').pop() || repoName : repoName;

  return baseName
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Imports a GitHub repository (or subdirectory) as a new project
 */
export async function importGitHubRepository(
  repoUrl: string,
  projectName: string,
  projectDescription: string,
  userId: string,
  branch?: string,
  path?: string
): Promise<ImportResult> {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return { success: false, error: 'Invalid GitHub URL' };
  }

  // Use provided branch/path or fall back to parsed values
  const finalBranch = branch || parsed.branch;
  const finalPath = path || parsed.path;

  try {
    // 1. Create project in Supabase first
    const { data: project, error: dbError } = await supabase
      .from('projects')
      .insert({
        user_id: userId,
        name: projectName,
        description: projectDescription,
        code: '// Importing from GitHub...',
        source_url: parsed.url,
        metadata: {
          import_type: 'github',
          import_started_at: new Date().toISOString(),
          github_owner: parsed.owner,
          github_repo: parsed.repo,
          github_branch: finalBranch,
          github_path: finalPath,
        },
      })
      .select()
      .single();

    if (dbError || !project) {
      return { success: false, error: dbError?.message || 'Failed to create project' };
    }

    // 2. Clone repository via backend
    try {
      const cloneResponse = await fetch(`${API_URL}/api/github/clone`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          project_id: project.id,
          repo_url: parsed.url,
          branch: finalBranch,
          path: finalPath,
        }),
      });

      if (!cloneResponse.ok) {
        const errorData = await cloneResponse.json().catch(() => ({}));
        throw new Error(errorData.message || `Clone failed: ${cloneResponse.status}`);
      }

      const cloneResult = await cloneResponse.json();

      // 3. Update project metadata with clone results
      const mainCode = cloneResult.data?.main_code || '';
      const filesCount = cloneResult.data?.files_count || 0;

      await supabase
        .from('projects')
        .update({
          code: mainCode,
          metadata: {
            import_type: 'github',
            import_completed_at: new Date().toISOString(),
            github_owner: parsed.owner,
            github_repo: parsed.repo,
            github_branch: parsed.branch,
            github_path: parsed.path,
            files_count: filesCount,
          },
        })
        .eq('id', project.id);

      return {
        success: true,
        projectId: project.id,
        filesCount,
      };
    } catch (cloneError) {
      // Cleanup: delete the project if clone fails
      await supabase.from('projects').delete().eq('id', project.id);
      throw cloneError;
    }
  } catch (error) {
    console.error('Error importing GitHub repository:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to import repository',
    };
  }
}
