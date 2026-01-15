use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CompileRequest {
    pub user_id: String,
    pub project_id: String,
    pub code: String,
}

#[derive(Debug, Deserialize)]
pub struct DeployRequest {
    pub user_id: String,
    pub project_id: String,
    pub account_id: Option<String>,
    pub rpc_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct MethodCallRequest {
    pub contract_address: String,
    pub method_name: String,
    pub args: serde_json::Value,
    pub method_type: String, // "view" or "call"
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: Option<T>,
    pub error: Option<ApiError>,
}

#[derive(Debug, Serialize)]
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CompileResponse {
    pub success: bool,
    pub exit_code: i32,
    pub stdout: String,
    pub stderr: String,
    pub details: CompileDetails,
    pub abi: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct CompileDetails {
    pub status: String,
    pub compilation_time: f64,
    pub project_path: String,
    pub wasm_size: Option<u64>,
    pub optimized: bool,
}

#[derive(Debug, Serialize)]
pub struct DeployResponse {
    pub success: bool,
    pub transaction_hash: String,
    pub contract_id: String,
    pub explorer_url: String,
    pub gas_used: Option<String>,
    pub proof_tx_hash: Option<String>,
    pub details: DeployDetails,
    pub github_repo_url: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DeployDetails {
    pub network: String,
    pub block_height: u64,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub deployer_account: String,
}

#[derive(Debug, Serialize)]
pub struct MethodCallResponse {
    pub success: bool,
    pub result: Option<serde_json::Value>,
    pub transaction_hash: Option<String>,
    pub logs: Vec<String>,
    pub gas_used: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub version: String,
}

// Filesystem API models
#[derive(Debug, Deserialize)]
pub struct FileTreeRequest {
    pub user_id: String,
    pub project_id: String,
}

#[derive(Debug, Deserialize)]
pub struct FileReadRequest {
    pub user_id: String,
    pub project_id: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct FileWriteRequest {
    pub user_id: String,
    pub project_id: String,
    pub path: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct FileCreateRequest {
    pub user_id: String,
    pub project_id: String,
    pub path: String,
    #[serde(default)]
    pub is_directory: bool,
}

#[derive(Debug, Deserialize)]
pub struct FileDeleteRequest {
    pub user_id: String,
    pub project_id: String,
    pub path: String,
}

#[derive(Debug, Deserialize)]
pub struct FileRenameRequest {
    pub user_id: String,
    pub project_id: String,
    pub old_path: String,
    pub new_path: String,
}

#[derive(Debug, Deserialize)]
pub struct FileMoveRequest {
    pub user_id: String,
    pub project_id: String,
    pub source_path: String,
    pub destination_path: String,
}

#[derive(Debug, Deserialize)]
pub struct FileSearchRequest {
    pub user_id: String,
    pub project_id: String,
    pub query: String,
    pub search_content: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct FileSearchResult {
    pub path: String,
    pub name: String,
    pub preview: Option<String>,
    pub line_number: Option<usize>,
}

#[derive(Debug, Serialize)]
pub struct FileSearchResponse {
    pub results: Vec<FileSearchResult>,
    pub total_matches: usize,
}

#[derive(Debug, Deserialize)]
pub struct ProjectInitRequest {
    pub user_id: String,
    pub project_id: String,
    pub template: Option<String>,
    pub code: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T, message: String) -> Self {
        Self {
            success: true,
            message,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(code: String, message: String, details: Option<String>) -> Self {
        Self {
            success: false,
            message: message.clone(),
            data: None,
            error: Some(ApiError { code, message, details }),
        }
    }
}

// Verification API models
#[derive(Debug, Deserialize)]
pub struct VerificationPackageRequest {
    pub user_id: String,
    pub project_id: String,
}

#[derive(Debug, Deserialize)]
pub struct VerificationMetadataRequest {
    pub user_id: String,
    pub project_id: String,
}

#[derive(Debug, Serialize)]
pub struct VerificationPackageResponse {
    pub zip_base64: String,
    pub file_count: usize,
    pub total_size: usize,
}

// Source publishing API models
#[derive(Debug, Deserialize)]
pub struct PublishSourceRequest {
    pub user_id: String,
    pub project_id: String,
    pub contract_id: String,
}

#[derive(Debug, Serialize)]
pub struct PublishSourceResponse {
    pub repo_url: String,
    pub repo_name: String,
}

// Verification status API models
#[derive(Debug, Deserialize)]
pub struct VerificationStatusQuery {
    pub contract_id: String,
    pub network: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct VerificationStatusResponse {
    pub verified: bool,
    pub verification_date: Option<String>,
}

// GitHub clone API models
#[derive(Debug, Deserialize)]
pub struct GitHubCloneRequest {
    pub user_id: String,
    pub project_id: String,
    pub repo_url: String,
    pub branch: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct GitHubCloneResponse {
    pub success: bool,
    pub files_count: usize,
    pub message: String,
    pub main_code: Option<String>,
}

// Project export API models
#[derive(Debug, Deserialize)]
pub struct ProjectExportQuery {
    pub user_id: String,
    pub project_id: String,
}

// Faucet API models
#[derive(Debug, Deserialize)]
pub struct FaucetRequest {
    pub user_id: String,
    pub recipient_account: String,
    pub turnstile_token: String,
}

#[derive(Debug, Serialize)]
pub struct FaucetResponse {
    pub success: bool,
    pub transaction_hash: Option<String>,
    pub explorer_url: Option<String>,
    pub error: Option<String>,
    pub next_available_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FaucetStatusQuery {
    pub user_id: String,
}

#[derive(Debug, Serialize)]
pub struct FaucetStatusResponse {
    pub can_request: bool,
    pub last_request_at: Option<String>,
    pub next_available_at: Option<String>,
    pub faucet_balance: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct FaucetHistoryQuery {
    pub user_id: String,
}

#[derive(Debug, Serialize)]
pub struct FaucetHistoryItem {
    pub id: String,
    pub recipient_account: String,
    pub amount: f64,
    pub status: String,
    pub transaction_hash: Option<String>,
    pub explorer_url: Option<String>,
    pub error_message: Option<String>,
    pub created_at: String,
}

// Template API models
#[derive(Debug, Deserialize)]
pub struct TemplateCreateFromGitHubRequest {
    pub template_id: String,
    pub github_url: String,
    pub branch: Option<String>,
    pub path: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TemplateCreateFromProjectRequest {
    pub template_id: String,
    pub user_id: String,
    pub project_id: String,
}

#[derive(Debug, Deserialize)]
pub struct TemplateUseRequest {
    pub template_id: String,
    pub user_id: String,
    pub new_project_id: String,
}

#[derive(Debug, Deserialize)]
pub struct TemplateFileRequest {
    pub template_id: String,
    pub path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TemplateCreateResponse {
    pub success: bool,
    pub storage_path: Option<String>,
    pub message: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TemplateUseResponse {
    pub success: bool,
    pub project_path: Option<String>,
    pub message: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TemplateFileResponse {
    pub path: String,
    pub content: String,
    pub size: u64,
}