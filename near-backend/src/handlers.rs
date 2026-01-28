use actix_web::{web, HttpResponse, Result};
use base64::{Engine as _, engine::general_purpose::STANDARD};
use log::{error, info, warn};
use std::sync::Arc;

use crate::models::{
    ApiResponse, CompileRequest, CompileResponse, DeployRequest, DeployResponse, HealthResponse,
    MethodCallRequest, MethodCallResponse,
    FileTreeRequest, FileReadRequest, FileWriteRequest, FileCreateRequest,
    FileDeleteRequest, FileRenameRequest, FileMoveRequest, ProjectInitRequest,
    FileSearchRequest, FileSearchResponse,
    VerificationPackageRequest, VerificationMetadataRequest, VerificationPackageResponse,
    PublishSourceRequest, PublishSourceResponse,
    VerificationStatusQuery, VerificationStatusResponse,
    VerifyContractRequest, VerifyContractResponse,
    GitHubCloneRequest, GitHubCloneResponse,
    FaucetRequest, FaucetResponse, FaucetStatusQuery, FaucetStatusResponse,
    FaucetHistoryQuery, FaucetHistoryItem,
};
use crate::services::{
    compilation::compile_contract,
    deployment::deploy_contract,
    faucet::{check_account_exists, transfer_near, get_faucet_balance, check_rate_limit, get_faucet_history},
    method_call::call_contract_method,
    filesystem::{FileSystemService, FileNode, FileContent},
    verification::{VerificationService, ProjectMetadata, get_onchain_hash},
    github::GitHubService,
};

pub async fn health_handler() -> Result<HttpResponse> {
    let response = HealthResponse {
        status: "ok".to_string(),
        timestamp: chrono::Utc::now(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    };

    Ok(HttpResponse::Ok().json(ApiResponse::success(
        response,
        "NEAR Playground Backend is running".to_string(),
    )))
}

pub async fn compile_handler(req: web::Json<CompileRequest>) -> Result<HttpResponse> {
    info!(
        "Compilation request received for project: {}",
        req.project_id
    );

    match compile_contract(&req.code, &req.user_id, &req.project_id).await {
        Ok(compile_result) => {
            info!("Compilation completed for project: {}", req.project_id);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                compile_result,
                "Compilation completed successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Compilation failed for project {}: {}", req.project_id, e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<CompileResponse>::error(
                    "COMPILATION_FAILED".to_string(),
                    "Failed to compile contract".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn deploy_handler(
    req: web::Json<DeployRequest>,
) -> Result<HttpResponse> {
    info!("Deployment request received for project: {}", req.project_id);

    match deploy_contract(&req.user_id, &req.project_id, req.account_id.as_deref(), req.rpc_url.as_deref()).await {
        Ok(deploy_result) => {
            info!("Deployment completed for project: {}", req.project_id);
            // Note: GitHub publishing now happens via /api/source/publish when user chooses to verify

            Ok(HttpResponse::Ok().json(ApiResponse::success(
                deploy_result,
                "Contract deployed successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Deployment failed for project {}: {}", req.project_id, e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<DeployResponse>::error(
                    "DEPLOYMENT_FAILED".to_string(),
                    "Failed to deploy contract".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn method_call_handler(req: web::Json<MethodCallRequest>) -> Result<HttpResponse> {
    info!(
        "Method call request received for contract: {} method: {}",
        req.contract_address, req.method_name
    );

    match call_contract_method(
        &req.contract_address,
        &req.method_name,
        &req.args,
        &req.method_type,
        req.rpc_url.as_deref(),
    ).await {
        Ok(call_result) => {
            info!(
                "Method call completed for contract: {} method: {}",
                req.contract_address, req.method_name
            );
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                call_result,
                "Method call completed successfully".to_string(),
            )))
        }
        Err(e) => {
            error!(
                "Method call failed for contract {}: {}",
                req.contract_address, e
            );
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<MethodCallResponse>::error(
                    "METHOD_CALL_FAILED".to_string(),
                    "Failed to call contract method".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

// Filesystem handlers

pub async fn filesystem_tree_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    query: web::Query<FileTreeRequest>,
) -> Result<HttpResponse> {
    info!(
        "File tree request for user: {}, project: {}",
        query.user_id, query.project_id
    );

    match fs_service.get_project_tree(&query.user_id, &query.project_id).await {
        Ok(tree) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                tree,
                "File tree retrieved successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to get file tree: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<FileNode>::error(
                    "FILE_TREE_ERROR".to_string(),
                    "Failed to retrieve file tree".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn filesystem_read_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<FileReadRequest>,
) -> Result<HttpResponse> {
    info!(
        "File read request for path: {} in project: {}",
        req.path, req.project_id
    );

    match fs_service.read_file(&req.user_id, &req.project_id, &req.path).await {
        Ok(content) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                content,
                "File read successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to read file: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<FileContent>::error(
                    "FILE_READ_ERROR".to_string(),
                    "Failed to read file".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn filesystem_write_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<FileWriteRequest>,
) -> Result<HttpResponse> {
    info!(
        "File write request for path: {} in project: {}",
        req.path, req.project_id
    );

    match fs_service.write_file(&req.user_id, &req.project_id, &req.path, &req.content).await {
        Ok(content) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                content,
                "File written successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to write file: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<FileContent>::error(
                    "FILE_WRITE_ERROR".to_string(),
                    "Failed to write file".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn filesystem_create_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<FileCreateRequest>,
) -> Result<HttpResponse> {
    info!(
        "File create request for path: {} (is_directory: {}) in project: {}",
        req.path, req.is_directory, req.project_id
    );

    if req.is_directory {
        match fs_service.create_directory(&req.user_id, &req.project_id, &req.path).await {
            Ok(()) => {
                Ok(HttpResponse::Ok().json(ApiResponse::success(
                    serde_json::json!({"path": req.path, "is_directory": true}),
                    "Directory created successfully".to_string(),
                )))
            }
            Err(e) => {
                error!("Failed to create directory: {}", e);
                Ok(HttpResponse::InternalServerError().json(
                    ApiResponse::<serde_json::Value>::error(
                        "DIRECTORY_CREATE_ERROR".to_string(),
                        "Failed to create directory".to_string(),
                        Some(e.to_string()),
                    ),
                ))
            }
        }
    } else {
        match fs_service.create_file(&req.user_id, &req.project_id, &req.path).await {
            Ok(content) => {
                Ok(HttpResponse::Ok().json(ApiResponse::success(
                    content,
                    "File created successfully".to_string(),
                )))
            }
            Err(e) => {
                error!("Failed to create file: {}", e);
                Ok(HttpResponse::InternalServerError().json(
                    ApiResponse::<FileContent>::error(
                        "FILE_CREATE_ERROR".to_string(),
                        "Failed to create file".to_string(),
                        Some(e.to_string()),
                    ),
                ))
            }
        }
    }
}

pub async fn filesystem_delete_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<FileDeleteRequest>,
) -> Result<HttpResponse> {
    info!(
        "File delete request for path: {} in project: {}",
        req.path, req.project_id
    );

    match fs_service.delete_file(&req.user_id, &req.project_id, &req.path).await {
        Ok(()) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                serde_json::json!({"deleted": true, "path": req.path}),
                "File deleted successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to delete file: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<serde_json::Value>::error(
                    "FILE_DELETE_ERROR".to_string(),
                    "Failed to delete file".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn filesystem_rename_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<FileRenameRequest>,
) -> Result<HttpResponse> {
    info!(
        "File rename request from: {} to: {} in project: {}",
        req.old_path, req.new_path, req.project_id
    );

    match fs_service.rename_file(&req.user_id, &req.project_id, &req.old_path, &req.new_path).await {
        Ok(()) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                serde_json::json!({"old_path": req.old_path, "new_path": req.new_path}),
                "File renamed successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to rename file: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<serde_json::Value>::error(
                    "FILE_RENAME_ERROR".to_string(),
                    "Failed to rename file".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn filesystem_mkdir_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<FileCreateRequest>,
) -> Result<HttpResponse> {
    info!(
        "Directory create request for path: {} in project: {}",
        req.path, req.project_id
    );

    match fs_service.create_directory(&req.user_id, &req.project_id, &req.path).await {
        Ok(()) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                serde_json::json!({"path": req.path, "is_directory": true}),
                "Directory created successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to create directory: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<serde_json::Value>::error(
                    "DIRECTORY_CREATE_ERROR".to_string(),
                    "Failed to create directory".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn filesystem_move_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<FileMoveRequest>,
) -> Result<HttpResponse> {
    info!(
        "File move request from: {} to: {} in project: {}",
        req.source_path, req.destination_path, req.project_id
    );

    match fs_service.move_file(&req.user_id, &req.project_id, &req.source_path, &req.destination_path).await {
        Ok(()) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                serde_json::json!({"source_path": req.source_path, "destination_path": req.destination_path}),
                "File moved successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to move file: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<serde_json::Value>::error(
                    "FILE_MOVE_ERROR".to_string(),
                    "Failed to move file".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn project_init_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<ProjectInitRequest>,
) -> Result<HttpResponse> {
    info!(
        "Project init request for user: {}, project: {}",
        req.user_id, req.project_id
    );

    match fs_service.init_project(&req.user_id, &req.project_id, req.code.as_deref()).await {
        Ok(path) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                serde_json::json!({
                    "user_id": req.user_id,
                    "project_id": req.project_id,
                    "path": path.to_string_lossy()
                }),
                "Project initialized successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to initialize project: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<serde_json::Value>::error(
                    "PROJECT_INIT_ERROR".to_string(),
                    "Failed to initialize project".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn filesystem_search_handler(
    fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<FileSearchRequest>,
) -> Result<HttpResponse> {
    info!(
        "File search request for query: '{}' in project: {} (content search: {})",
        req.query, req.project_id, req.search_content
    );

    match fs_service.search_files(&req.user_id, &req.project_id, &req.query, req.search_content).await {
        Ok(results) => {
            let total_matches = results.len();
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                FileSearchResponse {
                    results,
                    total_matches,
                },
                "Search completed successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to search files: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<FileSearchResponse>::error(
                    "FILE_SEARCH_ERROR".to_string(),
                    "Failed to search files".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

// Verification handlers

pub async fn verification_package_handler(
    verification_service: web::Data<Arc<VerificationService>>,
    req: web::Json<VerificationPackageRequest>,
) -> Result<HttpResponse> {
    info!(
        "Verification package request for user: {}, project: {}",
        req.user_id, req.project_id
    );

    match verification_service.package_source(&req.user_id, &req.project_id).await {
        Ok(zip_bytes) => {
            let zip_base64 = STANDARD.encode(&zip_bytes);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                VerificationPackageResponse {
                    zip_base64,
                    file_count: 0, // Could be enhanced to track this
                    total_size: zip_bytes.len(),
                },
                "Source package created successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to package source: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<VerificationPackageResponse>::error(
                    "PACKAGE_ERROR".to_string(),
                    "Failed to package source files".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn verification_metadata_handler(
    verification_service: web::Data<Arc<VerificationService>>,
    req: web::Json<VerificationMetadataRequest>,
) -> Result<HttpResponse> {
    info!(
        "Verification metadata request for user: {}, project: {}",
        req.user_id, req.project_id
    );

    match verification_service.get_project_metadata(&req.user_id, &req.project_id).await {
        Ok(metadata) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                metadata,
                "Project metadata retrieved successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to get project metadata: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<ProjectMetadata>::error(
                    "METADATA_ERROR".to_string(),
                    "Failed to retrieve project metadata".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

// Source publishing handler

pub async fn publish_source_handler(
    github_service: web::Data<Arc<GitHubService>>,
    verification_service: web::Data<Arc<VerificationService>>,
    req: web::Json<PublishSourceRequest>,
) -> Result<HttpResponse> {
    info!(
        "Publish source request for user: {}, project: {}, contract: {}",
        req.user_id, req.project_id, req.contract_id
    );

    // Get project source files (sanitized)
    let files = match verification_service
        .get_publishable_files(&req.user_id, &req.project_id)
        .await
    {
        Ok(f) => f,
        Err(e) => {
            error!("Failed to get publishable files: {}", e);
            return Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<PublishSourceResponse>::error(
                    "PUBLISH_ERROR".to_string(),
                    "Failed to get project files".to_string(),
                    Some(e.to_string()),
                ),
            ));
        }
    };

    // Publish to GitHub
    match github_service
        .publish_contract_source(&req.contract_id, files)
        .await
    {
        Ok(repo) => {
            info!("Source published successfully to: {}", repo.html_url);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                PublishSourceResponse {
                    repo_url: repo.html_url,
                    repo_name: repo.full_name,
                },
                "Source published successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to publish source: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<PublishSourceResponse>::error(
                    "PUBLISH_ERROR".to_string(),
                    "Failed to publish source to GitHub".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn check_verification_status_handler(
    query: web::Query<VerificationStatusQuery>,
) -> Result<HttpResponse> {
    let contract_id = &query.contract_id;
    let network = query.network.as_deref().unwrap_or("testnet");

    info!("Checking verification status for contract: {} on {}", contract_id, network);

    // Verification status is stored in frontend (Supabase)
    // This endpoint just returns not verified - frontend checks its own data
    Ok(HttpResponse::Ok().json(ApiResponse::success(
        VerificationStatusResponse {
            verified: false,
            verification_date: None,
        },
        "Check frontend for verification status".to_string(),
    )))
}

/// Get on-chain bytecode hash for a contract
/// Frontend compares this with stored compiled hash
pub async fn verify_contract_handler(
    req: web::Json<VerifyContractRequest>,
) -> Result<HttpResponse> {
    let contract_id = &req.contract_id;
    let network = req.network.as_deref().unwrap_or("testnet");

    info!("Fetching on-chain hash for contract: {} on {}", contract_id, network);

    match get_onchain_hash(contract_id, network).await {
        Ok(onchain_hash) => {
            info!("Retrieved on-chain hash for {}: {}", contract_id, onchain_hash);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                VerifyContractResponse {
                    verified: false, // Frontend will determine this
                    compiled_hash: String::new(), // Frontend has this
                    onchain_hash,
                    verified_at: None,
                },
                "On-chain hash retrieved".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to get on-chain hash for contract {}: {}", contract_id, e);
            Ok(HttpResponse::BadRequest().json(
                ApiResponse::<VerifyContractResponse>::error(
                    "VERIFICATION_ERROR".to_string(),
                    e.to_string(),
                    None,
                ),
            ))
        }
    }
}

// WASM download handler for wallet-based deployment

pub async fn get_wasm_handler(
    path: web::Path<(String, String)>,
) -> Result<HttpResponse> {
    let (user_id, project_id) = path.into_inner();
    info!("WASM download request for user: {}, project: {}", user_id, project_id);

    let projects_path = std::path::PathBuf::from("projects");
    let project_path = projects_path.join(&user_id).join(&project_id);
    let target_dir = project_path.join("target").join("near");

    // Check if target directory exists
    if !target_dir.exists() {
        return Ok(HttpResponse::NotFound().json(
            ApiResponse::<()>::error(
                "WASM_NOT_FOUND".to_string(),
                "No compiled WASM found. Please compile your project first.".to_string(),
                None,
            ),
        ));
    }

    // Find the .wasm file in target/near
    let wasm_file = match std::fs::read_dir(&target_dir) {
        Ok(entries) => {
            entries
                .filter_map(|e| e.ok())
                .find(|e| {
                    e.path()
                        .extension()
                        .map(|ext| ext == "wasm")
                        .unwrap_or(false)
                })
                .map(|e| e.path())
        }
        Err(e) => {
            error!("Failed to read target directory: {}", e);
            return Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(
                    "WASM_READ_ERROR".to_string(),
                    "Failed to read project build directory".to_string(),
                    Some(e.to_string()),
                ),
            ));
        }
    };

    let wasm_path = match wasm_file {
        Some(path) => path,
        None => {
            return Ok(HttpResponse::NotFound().json(
                ApiResponse::<()>::error(
                    "WASM_NOT_FOUND".to_string(),
                    "No WASM file found in build directory. Please compile your project first.".to_string(),
                    None,
                ),
            ));
        }
    };

    // Read and return the WASM file
    match std::fs::read(&wasm_path) {
        Ok(wasm_data) => {
            info!("Serving WASM file: {} ({} bytes)", wasm_path.display(), wasm_data.len());
            Ok(HttpResponse::Ok()
                .content_type("application/wasm")
                .body(wasm_data))
        }
        Err(e) => {
            error!("Failed to read WASM file: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(
                    "WASM_READ_ERROR".to_string(),
                    "Failed to read WASM file".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

// GitHub clone handler
pub async fn github_clone_handler(
    _fs_service: web::Data<Arc<FileSystemService>>,
    req: web::Json<GitHubCloneRequest>,
) -> Result<HttpResponse> {
    info!(
        "GitHub clone request for user: {}, project: {}, repo: {}, branch: {:?}, path: {:?}",
        req.user_id, req.project_id, req.repo_url, req.branch, req.path
    );

    let projects_path = std::path::PathBuf::from("projects");
    let project_path = projects_path.join(&req.user_id).join(&req.project_id);
    let temp_clone_path = projects_path.join(&req.user_id).join(format!("{}_temp", req.project_id));

    // Clean up existing directories
    for path in [&project_path, &temp_clone_path] {
        if path.exists() {
            if let Err(e) = std::fs::remove_dir_all(path) {
                error!("Failed to clean directory: {}", e);
                return Ok(HttpResponse::BadRequest().json(
                    ApiResponse::<GitHubCloneResponse>::error(
                        "CLONE_ERROR".to_string(),
                        "Failed to prepare project directory".to_string(),
                        Some(e.to_string()),
                    ),
                ));
            }
        }
    }

    // Determine clone target (temp if path specified, otherwise final location)
    let clone_target = if req.path.is_some() {
        &temp_clone_path
    } else {
        &project_path
    };

    // Create the clone target directory
    if let Err(e) = std::fs::create_dir_all(clone_target) {
        error!("Failed to create project directory: {}", e);
        return Ok(HttpResponse::InternalServerError().json(
            ApiResponse::<GitHubCloneResponse>::error(
                "CLONE_ERROR".to_string(),
                "Failed to create project directory".to_string(),
                Some(e.to_string()),
            ),
        ));
    }

    // Build git clone command
    let mut git_cmd = std::process::Command::new("git");
    git_cmd.arg("clone").arg("--depth").arg("1");

    // Add branch if specified
    if let Some(ref branch) = req.branch {
        git_cmd.arg("--branch").arg(branch);
    }

    git_cmd.arg(&req.repo_url).arg(".").current_dir(clone_target);

    let output = git_cmd.output();

    match output {
        Ok(result) => {
            if !result.status.success() {
                let stderr = String::from_utf8_lossy(&result.stderr);
                error!("Git clone failed: {}", stderr);
                // Cleanup on failure
                let _ = std::fs::remove_dir_all(clone_target);
                return Ok(HttpResponse::BadRequest().json(
                    ApiResponse::<GitHubCloneResponse>::error(
                        "CLONE_ERROR".to_string(),
                        "Git clone failed".to_string(),
                        Some(stderr.to_string()),
                    ),
                ));
            }

            // Remove .git directory to save space
            let git_dir = clone_target.join(".git");
            if git_dir.exists() {
                let _ = std::fs::remove_dir_all(&git_dir);
            }

            // If a path was specified, move only that subdirectory to the project location
            if let Some(ref subpath) = req.path {
                let source_subdir = temp_clone_path.join(subpath);

                if !source_subdir.exists() {
                    // Cleanup
                    let _ = std::fs::remove_dir_all(&temp_clone_path);
                    return Ok(HttpResponse::BadRequest().json(
                        ApiResponse::<GitHubCloneResponse>::error(
                            "CLONE_ERROR".to_string(),
                            format!("Subdirectory '{}' not found in repository", subpath),
                            None,
                        ),
                    ));
                }

                // Move subdirectory contents to final project path
                if let Err(e) = move_dir_contents(&source_subdir, &project_path) {
                    error!("Failed to move subdirectory: {}", e);
                    let _ = std::fs::remove_dir_all(&temp_clone_path);
                    return Ok(HttpResponse::BadRequest().json(
                        ApiResponse::<GitHubCloneResponse>::error(
                            "CLONE_ERROR".to_string(),
                            "Failed to extract subdirectory".to_string(),
                            Some(e.to_string()),
                        ),
                    ));
                }

                // Cleanup temp directory
                let _ = std::fs::remove_dir_all(&temp_clone_path);
            }

            // Count files and find main code
            let (files_count, main_code) = count_project_files_and_get_main(&project_path);

            if files_count == 0 {
                // Cleanup on failure
                let _ = std::fs::remove_dir_all(&project_path);
                return Ok(HttpResponse::BadRequest().json(
                    ApiResponse::<GitHubCloneResponse>::error(
                        "CLONE_ERROR".to_string(),
                        "No valid project files found".to_string(),
                        None,
                    ),
                ));
            }

            info!("Clone successful: {} files", files_count);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                GitHubCloneResponse {
                    success: true,
                    files_count,
                    message: format!("Cloned {} files from repository", files_count),
                    main_code,
                },
                "Repository cloned successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to execute git clone: {}", e);
            // Cleanup on failure
            let _ = std::fs::remove_dir_all(&project_path);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<GitHubCloneResponse>::error(
                    "CLONE_ERROR".to_string(),
                    "Failed to execute git clone".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

/// Move directory contents from source to destination
fn move_dir_contents(source: &std::path::Path, dest: &std::path::Path) -> std::io::Result<()> {
    // Create destination directory if it doesn't exist
    std::fs::create_dir_all(dest)?;

    // Iterate over source directory contents
    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if source_path.is_dir() {
            // Recursively copy directories
            copy_dir_recursive(&source_path, &dest_path)?;
        } else {
            // Copy files
            std::fs::copy(&source_path, &dest_path)?;
        }
    }

    Ok(())
}

/// Recursively copy a directory
fn copy_dir_recursive(source: &std::path::Path, dest: &std::path::Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dest)?;

    for entry in std::fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let dest_path = dest.join(entry.file_name());

        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &dest_path)?;
        } else {
            std::fs::copy(&source_path, &dest_path)?;
        }
    }

    Ok(())
}

fn count_project_files_and_get_main(path: &std::path::Path) -> (usize, Option<String>) {
    let valid_extensions = ["rs", "toml", "md", "lock", "json", "yml", "yaml"];
    let mut count = 0;
    let mut main_code = None;

    // Priority order for main code file
    let main_files = [
        "src/lib.rs",
        "lib.rs",
        "src/main.rs",
        "main.rs",
    ];

    // Find main code file
    for main_file in &main_files {
        let file_path = path.join(main_file);
        if file_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                main_code = Some(content);
                break;
            }
        }
    }

    // Count valid files
    fn count_files(dir: &std::path::Path, extensions: &[&str], count: &mut usize) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                // Skip hidden files and directories
                if name.starts_with('.') {
                    continue;
                }

                // Skip target directory
                if name == "target" {
                    continue;
                }

                if path.is_dir() {
                    count_files(&path, extensions, count);
                } else if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                    if extensions.contains(&ext) {
                        *count += 1;
                    }
                }
            }
        }
    }

    count_files(path, &valid_extensions, &mut count);
    (count, main_code)
}

// Project export handler - creates ZIP and returns it
pub async fn project_export_handler(
    path: web::Path<(String, String)>,
) -> Result<HttpResponse> {
    let (user_id, project_id) = path.into_inner();
    info!("Project export request for user: {}, project: {}", user_id, project_id);

    let projects_path = std::path::PathBuf::from("projects");
    let project_path = projects_path.join(&user_id).join(&project_id);

    if !project_path.exists() {
        return Ok(HttpResponse::NotFound().json(
            ApiResponse::<()>::error(
                "PROJECT_NOT_FOUND".to_string(),
                "Project not found".to_string(),
                None,
            ),
        ));
    }

    // Create ZIP in memory
    let mut zip_buffer = Vec::new();
    {
        use std::io::Write;
        let mut zip = zip::ZipWriter::new(std::io::Cursor::new(&mut zip_buffer));

        let options = zip::write::FileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated);

        // Walk directory and add files
        fn add_dir_to_zip(
            zip: &mut zip::ZipWriter<std::io::Cursor<&mut Vec<u8>>>,
            path: &std::path::Path,
            base_path: &std::path::Path,
            options: zip::write::FileOptions,
        ) -> std::io::Result<()> {
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.filter_map(|e| e.ok()) {
                    let entry_path = entry.path();
                    let name = entry_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

                    // Skip hidden files, target directory, and .git
                    if name.starts_with('.') || name == "target" {
                        continue;
                    }

                    let relative_path = entry_path.strip_prefix(base_path)
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_default();

                    if entry_path.is_dir() {
                        // Add directory entry
                        let dir_name = format!("{}/", relative_path);
                        zip.add_directory(&dir_name, options)?;
                        add_dir_to_zip(zip, &entry_path, base_path, options)?;
                    } else {
                        // Add file
                        if let Ok(content) = std::fs::read(&entry_path) {
                            zip.start_file(&relative_path, options)?;
                            zip.write_all(&content)?;
                        }
                    }
                }
            }
            Ok(())
        }

        if let Err(e) = add_dir_to_zip(&mut zip, &project_path, &project_path, options) {
            error!("Failed to create ZIP: {}", e);
            return Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(
                    "EXPORT_ERROR".to_string(),
                    "Failed to create ZIP file".to_string(),
                    Some(e.to_string()),
                ),
            ));
        }

        if let Err(e) = zip.finish() {
            error!("Failed to finalize ZIP: {}", e);
            return Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(
                    "EXPORT_ERROR".to_string(),
                    "Failed to finalize ZIP file".to_string(),
                    Some(e.to_string()),
                ),
            ));
        }
    }

    info!("Export successful: {} bytes", zip_buffer.len());

    Ok(HttpResponse::Ok()
        .content_type("application/zip")
        .insert_header(("Content-Disposition", format!("attachment; filename=\"project-{}.zip\"", project_id)))
        .body(zip_buffer))
}

// Faucet handlers

pub async fn faucet_request_handler(
    req: web::Json<FaucetRequest>,
) -> Result<HttpResponse> {
    info!(
        "Faucet request from user: {} for account: {}",
        req.user_id, req.recipient_account
    );

    // 1. Check rate limit (24 hour limit per user)
    match check_rate_limit(&req.user_id).await {
        Ok(rate_limit_info) => {
            if !rate_limit_info.can_request {
                let next_available = rate_limit_info.next_available_at.clone().unwrap_or_default();
                return Ok(HttpResponse::TooManyRequests().json(
                    ApiResponse::<FaucetResponse>::error(
                        "RATE_LIMITED".to_string(),
                        format!("You already requested tokens in the last 24 hours. Next request available at: {}", next_available),
                        None,
                    ),
                ));
            }
        }
        Err(e) => {
            error!("Rate limit check error: {}", e);
            // If rate limit check fails, deny the request for security
            return Ok(HttpResponse::ServiceUnavailable().json(
                ApiResponse::<FaucetResponse>::error(
                    "RATE_LIMIT_CHECK_FAILED".to_string(),
                    "Unable to verify rate limit. Please try again later.".to_string(),
                    Some(e.to_string()),
                ),
            ));
        }
    }

    // 2. Validate recipient account format
    let account_regex = regex::Regex::new(r"^[a-z0-9_-]+\.testnet$").unwrap();
    if !account_regex.is_match(&req.recipient_account) {
        return Ok(HttpResponse::BadRequest().json(
            ApiResponse::<FaucetResponse>::error(
                "INVALID_ACCOUNT".to_string(),
                "Invalid testnet account format. Must end with .testnet".to_string(),
                None,
            ),
        ));
    }

    // 3. Check if account exists on testnet
    match check_account_exists(&req.recipient_account).await {
        Ok(exists) => {
            if !exists {
                return Ok(HttpResponse::BadRequest().json(
                    ApiResponse::<FaucetResponse>::error(
                        "ACCOUNT_NOT_FOUND".to_string(),
                        "Account does not exist on testnet".to_string(),
                        None,
                    ),
                ));
            }
        }
        Err(e) => {
            error!("Account check error: {}", e);
            return Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<FaucetResponse>::error(
                    "ACCOUNT_CHECK_ERROR".to_string(),
                    "Failed to verify account existence".to_string(),
                    Some(e.to_string()),
                ),
            ));
        }
    }

    // 4. Get faucet amount from environment (default 1 NEAR)
    let faucet_amount: f64 = std::env::var("FAUCET_AMOUNT_NEAR")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(1.0);

    // 5. Execute the transfer
    match transfer_near(&req.recipient_account, faucet_amount).await {
        Ok(result) => {
            if result.success {
                info!(
                    "Faucet transfer successful to {}: tx={}",
                    req.recipient_account,
                    result.transaction_hash.as_deref().unwrap_or("unknown")
                );

                Ok(HttpResponse::Ok().json(ApiResponse::success(
                    FaucetResponse {
                        success: true,
                        transaction_hash: result.transaction_hash,
                        explorer_url: result.explorer_url,
                        error: None,
                        next_available_at: None,
                    },
                    format!("Successfully sent {} NEAR to {}", faucet_amount, req.recipient_account),
                )))
            } else {
                Ok(HttpResponse::InternalServerError().json(
                    ApiResponse::<FaucetResponse>::error(
                        "TRANSFER_FAILED".to_string(),
                        "Token transfer failed".to_string(),
                        result.error,
                    ),
                ))
            }
        }
        Err(e) => {
            error!("Faucet transfer error: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<FaucetResponse>::error(
                    "TRANSFER_ERROR".to_string(),
                    "Failed to execute transfer".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn faucet_status_handler(
    query: web::Query<FaucetStatusQuery>,
) -> Result<HttpResponse> {
    info!("Faucet status request for user: {}", query.user_id);

    // Get faucet balance
    let balance = match get_faucet_balance().await {
        Ok(b) => Some(b),
        Err(e) => {
            warn!("Failed to get faucet balance: {}", e);
            None
        }
    };

    // Check rate limit status for this user
    let (can_request, last_request_at, next_available_at) = match check_rate_limit(&query.user_id).await {
        Ok(rate_limit_info) => (
            rate_limit_info.can_request,
            rate_limit_info.last_request_at,
            rate_limit_info.next_available_at,
        ),
        Err(e) => {
            warn!("Failed to check rate limit: {}", e);
            // Default to denying if check fails for security
            (false, None, None)
        }
    };

    Ok(HttpResponse::Ok().json(ApiResponse::success(
        FaucetStatusResponse {
            can_request,
            last_request_at,
            next_available_at,
            faucet_balance: balance,
        },
        "Faucet status retrieved".to_string(),
    )))
}

pub async fn faucet_history_handler(
    query: web::Query<FaucetHistoryQuery>,
) -> Result<HttpResponse> {
    info!("Faucet history request for user: {}", query.user_id);

    // Fetch history from Supabase
    match get_faucet_history(&query.user_id, 10).await {
        Ok(history) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                history,
                "Faucet history retrieved".to_string(),
            )))
        }
        Err(e) => {
            warn!("Failed to fetch faucet history: {}", e);
            // Return empty history on error
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                Vec::<FaucetHistoryItem>::new(),
                "Faucet history retrieved".to_string(),
            )))
        }
    }
}

// Template storage handlers

use crate::models::{
    TemplateCreateFromGitHubRequest, TemplateCreateFromProjectRequest,
    TemplateUseRequest, TemplateFileRequest,
    TemplateCreateResponse, TemplateUseResponse, TemplateFileResponse,
};
use crate::services::template_storage::TemplateStorageService;

pub async fn template_create_from_github_handler(
    template_service: web::Data<Arc<TemplateStorageService>>,
    req: web::Json<TemplateCreateFromGitHubRequest>,
) -> Result<HttpResponse> {
    info!(
        "Template create from GitHub: {} - {}",
        req.template_id, req.github_url
    );

    match template_service.clone_from_github(
        &req.template_id,
        &req.github_url,
        req.branch.as_deref(),
        req.path.as_deref(),
    ).await {
        Ok(storage_path) => {
            info!("Template {} created from GitHub", req.template_id);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                TemplateCreateResponse {
                    success: true,
                    storage_path: Some(storage_path),
                    message: "Template created from GitHub".to_string(),
                    error: None,
                },
                "Template created successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Template creation failed: {}", e);
            Ok(HttpResponse::BadRequest().json(
                ApiResponse::<TemplateCreateResponse>::error(
                    "TEMPLATE_CREATE_FAILED".to_string(),
                    "Failed to create template from GitHub".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn template_create_from_project_handler(
    template_service: web::Data<Arc<TemplateStorageService>>,
    req: web::Json<TemplateCreateFromProjectRequest>,
) -> Result<HttpResponse> {
    info!(
        "Template create from project: {} - {}/{}",
        req.template_id, req.user_id, req.project_id
    );

    match template_service.copy_from_project(
        &req.template_id,
        &req.user_id,
        &req.project_id,
    ).await {
        Ok(storage_path) => {
            info!("Template {} created from project", req.template_id);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                TemplateCreateResponse {
                    success: true,
                    storage_path: Some(storage_path),
                    message: "Template created from project".to_string(),
                    error: None,
                },
                "Template created successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Template creation failed: {}", e);
            Ok(HttpResponse::BadRequest().json(
                ApiResponse::<TemplateCreateResponse>::error(
                    "TEMPLATE_CREATE_FAILED".to_string(),
                    "Failed to create template from project".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn template_use_handler(
    template_service: web::Data<Arc<TemplateStorageService>>,
    req: web::Json<TemplateUseRequest>,
) -> Result<HttpResponse> {
    info!(
        "Template use: {} -> {}/{}",
        req.template_id, req.user_id, req.new_project_id
    );

    match template_service.use_template(
        &req.template_id,
        &req.user_id,
        &req.new_project_id,
    ).await {
        Ok(project_path) => {
            info!("Project {} created from template", req.new_project_id);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                TemplateUseResponse {
                    success: true,
                    project_path: Some(project_path.to_string_lossy().to_string()),
                    message: "Project created from template".to_string(),
                    error: None,
                },
                "Project created successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Template use failed: {}", e);
            Ok(HttpResponse::BadRequest().json(
                ApiResponse::<TemplateUseResponse>::error(
                    "TEMPLATE_USE_FAILED".to_string(),
                    "Failed to create project from template".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn template_files_handler(
    template_service: web::Data<Arc<TemplateStorageService>>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let template_id = path.into_inner();
    info!("Template files request: {}", template_id);

    match template_service.get_file_tree(&template_id).await {
        Ok(tree) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                tree,
                "Template files retrieved".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to get template files: {}", e);
            Ok(HttpResponse::NotFound().json(
                ApiResponse::<FileNode>::error(
                    "TEMPLATE_NOT_FOUND".to_string(),
                    "Template not found".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn template_file_content_handler(
    template_service: web::Data<Arc<TemplateStorageService>>,
    path: web::Path<(String, String)>,
) -> Result<HttpResponse> {
    let (template_id, file_path) = path.into_inner();
    info!("Template file content request: {} - {}", template_id, file_path);

    match template_service.get_file(&template_id, &file_path).await {
        Ok(content) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                TemplateFileResponse {
                    path: content.path,
                    content: content.content,
                    size: content.size,
                },
                "File content retrieved".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to get template file: {}", e);
            Ok(HttpResponse::NotFound().json(
                ApiResponse::<TemplateFileResponse>::error(
                    "FILE_NOT_FOUND".to_string(),
                    "File not found".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn template_main_code_handler(
    template_service: web::Data<Arc<TemplateStorageService>>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let template_id = path.into_inner();
    info!("Template main code request: {}", template_id);

    match template_service.get_main_code(&template_id).await {
        Ok(code) => {
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                TemplateFileResponse {
                    path: "src/lib.rs".to_string(),
                    content: code.clone(),
                    size: code.len() as u64,
                },
                "Main code retrieved".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to get template main code: {}", e);
            Ok(HttpResponse::NotFound().json(
                ApiResponse::<TemplateFileResponse>::error(
                    "CODE_NOT_FOUND".to_string(),
                    "Main code not found".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}

pub async fn template_delete_handler(
    template_service: web::Data<Arc<TemplateStorageService>>,
    path: web::Path<String>,
) -> Result<HttpResponse> {
    let template_id = path.into_inner();
    info!("Template delete request: {}", template_id);

    match template_service.delete_template(&template_id).await {
        Ok(_) => {
            info!("Template {} deleted", template_id);
            Ok(HttpResponse::Ok().json(ApiResponse::success(
                (),
                "Template deleted successfully".to_string(),
            )))
        }
        Err(e) => {
            error!("Failed to delete template: {}", e);
            Ok(HttpResponse::InternalServerError().json(
                ApiResponse::<()>::error(
                    "TEMPLATE_DELETE_FAILED".to_string(),
                    "Failed to delete template".to_string(),
                    Some(e.to_string()),
                ),
            ))
        }
    }
}