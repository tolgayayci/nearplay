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

export interface DeploymentWithProject extends Deployment {
  project?: {
    id: string;
    name: string;
  };
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

// File system types for multi-file editor

/** File tree node returned from backend filesystem API */
export interface FileNode {
  name: string;
  path: string;           // relative path: "src/lib.rs"
  is_directory: boolean;
  children?: FileNode[];
  size?: number;
  modified?: string;
}

/** Currently open file in editor */
export interface OpenFile {
  path: string;           // "src/lib.rs"
  name: string;           // "lib.rs"
  content: string;        // file content
  originalContent: string; // content when opened (for dirty detection)
  language: string;       // "rust", "toml", "markdown"
}

/** File content response from backend */
export interface FileContent {
  path: string;
  content: string;
  size: number;
  modified: string;
}

/** File type information for syntax highlighting and icons */
export interface FileTypeInfo {
  language: string;
  label: string;
  color: string;
}

/** Get file type info from file path */
export function getFileTypeInfo(path: string): FileTypeInfo {
  const ext = path.split('.').pop()?.toLowerCase();
  const name = path.split('/').pop()?.toLowerCase() || '';

  // Check for special filenames first
  if (name === 'cargo.toml') {
    return { language: 'toml', label: 'Cargo', color: 'text-orange-600' };
  }
  if (name === 'cargo.lock') {
    return { language: 'toml', label: 'Lock', color: 'text-gray-500' };
  }
  if (name === '.gitignore') {
    return { language: 'plaintext', label: 'Git', color: 'text-gray-500' };
  }

  switch (ext) {
    case 'rs':
      return { language: 'rust', label: 'Rust', color: 'text-orange-500' };
    case 'toml':
      return { language: 'toml', label: 'TOML', color: 'text-purple-500' };
    case 'md':
      return { language: 'markdown', label: 'Markdown', color: 'text-blue-500' };
    case 'json':
      return { language: 'json', label: 'JSON', color: 'text-yellow-600' };
    case 'yml':
    case 'yaml':
      return { language: 'yaml', label: 'YAML', color: 'text-red-500' };
    case 'txt':
      return { language: 'plaintext', label: 'Text', color: 'text-gray-400' };
    case 'sh':
    case 'bash':
      return { language: 'shell', label: 'Shell', color: 'text-green-500' };
    case 'css':
      return { language: 'css', label: 'CSS', color: 'text-blue-400' };
    case 'html':
      return { language: 'html', label: 'HTML', color: 'text-orange-400' };
    case 'js':
      return { language: 'javascript', label: 'JS', color: 'text-yellow-500' };
    case 'ts':
      return { language: 'typescript', label: 'TS', color: 'text-blue-600' };
    default:
      return { language: 'plaintext', label: 'File', color: 'text-gray-400' };
  }
}

/** Get language from file extension (legacy helper) */
export function getLanguageFromPath(path: string): string {
  return getFileTypeInfo(path).language;
}

/** Check if a file is dirty (has unsaved changes) */
export function isFileDirty(file: OpenFile): boolean {
  return file.content !== file.originalContent;
}

// File search types

export interface FileSearchResult {
  path: string;
  name: string;
  preview?: string;
  line_number?: number;
}

// Crates.io types for dependency management

export interface CrateInfo {
  id: string;
  name: string;
  description: string | null;
  downloads: number;
  recent_downloads: number;
  max_version: string;
  newest_version: string;
  max_stable_version: string | null;
  documentation: string | null;
  repository: string | null;
  exact_match: boolean;
}

export interface CrateVersion {
  num: string;
  yanked: boolean;
  license: string | null;
  crate_size: number | null;
  published_by: {
    id: number;
    login: string;
    name: string | null;
    avatar: string | null;
    url: string;
  } | null;
  created_at: string;
}

export interface CrateSearchResponse {
  crates: CrateInfo[];
  meta: {
    total: number;
    next_page: string | null;
    prev_page: string | null;
  };
}

export interface CrateVersionsResponse {
  versions: CrateVersion[];
}

// Faucet types

export interface FaucetRequest {
  id: string;
  user_id: string;
  recipient_account: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  transaction_hash?: string;
  error_message?: string;
  created_at: string;
}

export interface FaucetStatusResponse {
  can_request: boolean;
  last_request_at?: string;
  next_available_at?: string;
  faucet_balance?: number;
}

export interface FaucetRequestResponse {
  success: boolean;
  transaction_hash?: string;
  explorer_url?: string;
  error?: string;
  next_available_at?: string;
}

// ============================================
// Template Marketplace Types
// ============================================

export type TemplateSourceType = 'github' | 'project';  // No standalone - code stored in backend
export type TemplateDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Template {
  id: string;
  user_id: string;
  name: string;
  description?: string;

  // Source (code stored in backend template-storage/{template_id}/)
  source_type: TemplateSourceType;
  storage_path?: string;  // Backend storage path
  github_url?: string;
  github_owner?: string;
  github_repo?: string;
  github_branch?: string;
  github_path?: string;
  source_project_id?: string;

  // Metadata
  category: string;
  difficulty: TemplateDifficulty;
  tags: string[];
  icon: string;

  // Social
  likes_count: number;
  uses_count: number;
  view_count: number;

  // Status
  is_official: boolean;
  is_published: boolean;
  is_featured: boolean;

  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;

  // Joined data
  author?: {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
  };
  user_has_liked?: boolean;
}

// Generic like (works for templates, projects, etc.)
export interface Like {
  id: string;
  user_id: string;
  target_type: 'template' | 'project' | 'embed';
  target_id: string;
  created_at: string;
}

export interface TemplateFilters {
  search?: string;
  category?: string;
  difficulty?: TemplateDifficulty;
  tags?: string[];
  sortBy?: 'newest' | 'popular' | 'most_used' | 'most_liked';
  official?: boolean;
  featured?: boolean;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  source_type: TemplateSourceType;
  github_url?: string;  // For github source
  github_branch?: string;
  github_path?: string;
  source_project_id?: string;  // For project source
  category?: string;
  difficulty?: TemplateDifficulty;
  tags?: string[];
  icon?: string;
  is_published?: boolean;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  github_url?: string;
  category?: string;
  difficulty?: TemplateDifficulty;
  tags?: string[];
  icon?: string;
  is_published?: boolean;
}

// ============================================
// Embed System Types
// ============================================

export type EmbedSourceType = 'template' | 'project' | 'github';
export type EmbedButtonStyle = 'primary' | 'secondary' | 'outline' | 'ghost';
export type EmbedButtonSize = 'sm' | 'default' | 'lg';
export type EmbedTheme = 'auto' | 'light' | 'dark';

export interface Embed {
  id: string;
  user_id: string;

  // Source
  source_type: EmbedSourceType;
  template_id?: string;
  project_id?: string;
  github_url?: string;

  // Customization
  button_text: string;
  button_style: EmbedButtonStyle;
  button_size: EmbedButtonSize;
  theme: EmbedTheme;

  // Tracking
  click_count: number;
  view_count: number;

  // Metadata
  name?: string;
  created_at: string;
  updated_at: string;

  // Snapshot data (for project embeds)
  code?: string;
  snapshot_name?: string;
  snapshot_description?: string;

  // Joined data
  template?: Template;
  project?: Project;
  author?: {
    id: string;
    email: string;
    name?: string;
    avatar_url?: string;
  };
}

export interface EmbedClick {
  id: string;
  embed_id: string;
  referrer?: string;
  user_agent?: string;
  ip_hash?: string;
  created_at: string;
}

export interface CreateEmbedInput {
  source_type: EmbedSourceType;
  template_id?: string;
  project_id?: string;
  github_url?: string;
  button_text?: string;
  button_style?: EmbedButtonStyle;
  button_size?: EmbedButtonSize;
  theme?: EmbedTheme;
  name?: string;
}

export interface UpdateEmbedInput {
  button_text?: string;
  button_style?: EmbedButtonStyle;
  button_size?: EmbedButtonSize;
  theme?: EmbedTheme;
  name?: string;
}