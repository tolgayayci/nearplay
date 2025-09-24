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