use std::io::{Read, Write};
use std::path::PathBuf;
use std::env;
use anyhow::{Context, Result};
use zip::ZipWriter;
use zip::write::FileOptions;
use walkdir::WalkDir;
use sha2::{Sha256, Digest};
use log::{info, warn, error};
use near_jsonrpc_client::{methods, JsonRpcClient};
use near_jsonrpc_primitives::types::query::QueryResponseKind;
use near_primitives::types::AccountId;
use serde::{Deserialize, Serialize};

/// Verification service for packaging and verifying smart contracts
pub struct VerificationService {
    projects_path: PathBuf,
}

impl VerificationService {
    pub fn new(projects_path: PathBuf) -> Self {
        Self { projects_path }
    }

    /// Package project source files into a zip archive
    /// Returns the zip file as bytes
    pub async fn package_source(
        &self,
        user_id: &str,
        project_id: &str,
    ) -> Result<Vec<u8>> {
        let project_path = self.projects_path.join(user_id).join(project_id);

        if !project_path.exists() {
            return Err(anyhow::anyhow!("Project directory does not exist"));
        }

        // Files/directories to include in the package
        let include_patterns = vec![
            "src",
            "Cargo.toml",
            "Cargo.lock",
            "rust-toolchain.toml",
        ];

        // Create zip in memory
        let mut buffer = Vec::new();
        {
            let mut zip = ZipWriter::new(std::io::Cursor::new(&mut buffer));
            let options = FileOptions::default()
                .compression_method(zip::CompressionMethod::Deflated)
                .unix_permissions(0o644);

            for pattern in &include_patterns {
                let full_path = project_path.join(pattern);

                if full_path.is_file() {
                    // Add single file
                    let file_name = pattern.to_string();
                    zip.start_file(&file_name, options)?;

                    let mut file = std::fs::File::open(&full_path)?;
                    let mut contents = Vec::new();
                    file.read_to_end(&mut contents)?;
                    zip.write_all(&contents)?;
                } else if full_path.is_dir() {
                    // Add directory recursively
                    for entry in WalkDir::new(&full_path).into_iter().filter_map(|e| e.ok()) {
                        let path = entry.path();
                        let relative_path = path.strip_prefix(&project_path)?;
                        let path_str = relative_path.to_string_lossy();

                        if path.is_file() {
                            zip.start_file(path_str.as_ref(), options)?;

                            let mut file = std::fs::File::open(path)?;
                            let mut contents = Vec::new();
                            file.read_to_end(&mut contents)?;
                            zip.write_all(&contents)?;
                        } else if path.is_dir() && !path_str.is_empty() {
                            zip.add_directory(path_str.as_ref(), options)?;
                        }
                    }
                }
            }

            zip.finish()?;
        }

        Ok(buffer)
    }

    /// Get publishable files for GitHub (sanitized)
    /// Returns Vec of (path, content) tuples
    pub async fn get_publishable_files(
        &self,
        user_id: &str,
        project_id: &str,
    ) -> Result<Vec<(String, String)>> {
        let project_path = self.projects_path.join(user_id).join(project_id);

        if !project_path.exists() {
            return Err(anyhow::anyhow!("Project directory does not exist"));
        }

        let mut files = Vec::new();

        // Read and sanitize Cargo.toml
        let cargo_toml_path = project_path.join("Cargo.toml");
        if cargo_toml_path.exists() {
            let content = tokio::fs::read_to_string(&cargo_toml_path).await?;
            let sanitized = sanitize_cargo_toml(&content);
            files.push(("Cargo.toml".to_string(), sanitized));
        }

        // Read Cargo.lock (no sanitization needed)
        let cargo_lock_path = project_path.join("Cargo.lock");
        if cargo_lock_path.exists() {
            let content = tokio::fs::read_to_string(&cargo_lock_path).await?;
            files.push(("Cargo.lock".to_string(), content));
        }

        // Read src files (sanitized)
        let src_path = project_path.join("src");
        if src_path.exists() {
            for entry in WalkDir::new(&src_path).into_iter().filter_map(|e| e.ok()) {
                let path = entry.path();
                if path.is_file() {
                    // Only include .rs files
                    if let Some(ext) = path.extension() {
                        if ext == "rs" {
                            if let Ok(relative) = path.strip_prefix(&project_path) {
                                let content = tokio::fs::read_to_string(path).await?;
                                let sanitized = sanitize_source_for_publishing(&content);
                                files.push((relative.to_string_lossy().to_string(), sanitized));
                            }
                        }
                    }
                }
            }
        }

        Ok(files)
    }

    /// Get project metadata for verification
    pub async fn get_project_metadata(
        &self,
        user_id: &str,
        project_id: &str,
    ) -> Result<ProjectMetadata> {
        let project_path = self.projects_path.join(user_id).join(project_id);
        let cargo_toml_path = project_path.join("Cargo.toml");

        if !cargo_toml_path.exists() {
            return Err(anyhow::anyhow!("Cargo.toml not found"));
        }

        let cargo_content = tokio::fs::read_to_string(&cargo_toml_path).await?;

        // Parse Cargo.toml for package info
        let mut name = String::new();
        let mut version = String::new();

        for line in cargo_content.lines() {
            let trimmed = line.trim();
            if trimmed.starts_with("name") {
                if let Some(value) = extract_toml_string(trimmed) {
                    name = value;
                }
            } else if trimmed.starts_with("version") && version.is_empty() {
                if let Some(value) = extract_toml_string(trimmed) {
                    version = value;
                }
            }
        }

        // Check for rust-toolchain.toml
        let toolchain_path = project_path.join("rust-toolchain.toml");
        let rust_version = if toolchain_path.exists() {
            let content = tokio::fs::read_to_string(&toolchain_path).await?;
            extract_rust_version(&content)
        } else {
            None
        };

        // List source files
        let src_path = project_path.join("src");
        let mut source_files = Vec::new();
        if src_path.exists() {
            for entry in WalkDir::new(&src_path).into_iter().filter_map(|e| e.ok()) {
                if entry.path().is_file() {
                    if let Ok(relative) = entry.path().strip_prefix(&project_path) {
                        source_files.push(relative.to_string_lossy().to_string());
                    }
                }
            }
        }

        Ok(ProjectMetadata {
            name,
            version,
            rust_version,
            source_files,
            build_command: "cargo near build".to_string(),
        })
    }
}

/// Project metadata for verification
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProjectMetadata {
    pub name: String,
    pub version: String,
    pub rust_version: Option<String>,
    pub source_files: Vec<String>,
    pub build_command: String,
}

/// Extract a string value from a TOML line like: name = "value"
fn extract_toml_string(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.splitn(2, '=').collect();
    if parts.len() == 2 {
        let value = parts[1].trim();
        if value.starts_with('"') && value.ends_with('"') {
            return Some(value[1..value.len()-1].to_string());
        }
    }
    None
}

/// Extract Rust version from rust-toolchain.toml
fn extract_rust_version(content: &str) -> Option<String> {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("channel") {
            return extract_toml_string(trimmed);
        }
    }
    None
}

/// Sanitize source code for public publishing
/// Removes any potential secrets or sensitive data
fn sanitize_source_for_publishing(content: &str) -> String {
    let sensitive_patterns = [
        "PRIVATE_KEY",
        "SECRET_KEY",
        "API_KEY",
        "PASSWORD",
        "CREDENTIAL",
        "ACCESS_TOKEN",
    ];

    content
        .lines()
        .filter(|line| {
            let upper = line.to_uppercase();
            !sensitive_patterns.iter().any(|p| upper.contains(p))
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Sanitize Cargo.toml - remove any private registry credentials
fn sanitize_cargo_toml(content: &str) -> String {
    let mut result = Vec::new();
    let mut skip_section = false;

    for line in content.lines() {
        // Skip [registry] and [credentials] sections
        if line.starts_with("[registry") || line.starts_with("[credentials") {
            skip_section = true;
            continue;
        }
        // New section starts
        if skip_section && line.starts_with('[') {
            skip_section = false;
        }
        if !skip_section {
            result.push(line);
        }
    }

    result.join("\n")
}

// ============================================================================
// Contract Verification Functions (Self-hosted verification)
// ============================================================================

const DEFAULT_TESTNET_RPC_URL: &str = "https://rpc.testnet.near.org";
const DEFAULT_MAINNET_RPC_URL: &str = "https://rpc.mainnet.near.org";

/// Calculate SHA256 hash of data and return as prefixed hex string
pub fn calculate_sha256(data: &[u8]) -> String {
    let hash = Sha256::digest(data);
    format!("sha256:{}", hex::encode(hash))
}

/// Get the RPC URL for a given network
fn get_rpc_url(network: &str) -> String {
    match network {
        "mainnet" => env::var("NEAR_MAINNET_RPC_URL")
            .unwrap_or_else(|_| DEFAULT_MAINNET_RPC_URL.to_string()),
        _ => env::var("NEAR_RPC_URL")
            .unwrap_or_else(|_| DEFAULT_TESTNET_RPC_URL.to_string()),
    }
}

/// Fetch the deployed contract bytecode from the NEAR blockchain
pub async fn fetch_onchain_code(contract_id: &str, network: &str) -> Result<Vec<u8>> {
    let rpc_url = get_rpc_url(network);
    let client = JsonRpcClient::connect(&rpc_url);

    let account_id: AccountId = contract_id.parse()
        .context("Invalid contract ID format")?;

    let request = methods::query::RpcQueryRequest {
        block_reference: near_primitives::types::BlockReference::latest(),
        request: near_primitives::views::QueryRequest::ViewCode {
            account_id,
        },
    };

    let response = client.call(request).await
        .context("Failed to fetch on-chain code")?;

    match response.kind {
        QueryResponseKind::ViewCode(code) => Ok(code.code),
        _ => Err(anyhow::anyhow!("Unexpected response type from ViewCode query")),
    }
}

/// Get the on-chain bytecode hash for a contract
/// Returns the hash for frontend to compare with stored compiled hash
pub async fn get_onchain_hash(contract_id: &str, network: &str) -> Result<String> {
    info!("Fetching on-chain hash for contract {} on {}", contract_id, network);

    let onchain_code = fetch_onchain_code(contract_id, network).await?;
    let onchain_hash = calculate_sha256(&onchain_code);

    info!("On-chain hash for {}: {}", contract_id, onchain_hash);
    Ok(onchain_hash)
}

/// Result of fetching on-chain hash
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OnchainHashResult {
    pub contract_id: String,
    pub network: String,
    pub onchain_hash: String,
}
