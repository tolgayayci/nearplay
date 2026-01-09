use actix_web::{web, HttpResponse, Result};
use log::{error, info};
use std::sync::Arc;

use crate::models::{
    ApiResponse, CompileRequest, CompileResponse, DeployRequest, DeployResponse, HealthResponse,
    MethodCallRequest, MethodCallResponse,
    FileTreeRequest, FileReadRequest, FileWriteRequest, FileCreateRequest,
    FileDeleteRequest, FileRenameRequest, FileMoveRequest, ProjectInitRequest,
    FileSearchRequest, FileSearchResponse,
};
use crate::services::{
    compilation::compile_contract,
    deployment::deploy_contract,
    method_call::call_contract_method,
    filesystem::{FileSystemService, FileNode, FileContent},
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

pub async fn deploy_handler(req: web::Json<DeployRequest>) -> Result<HttpResponse> {
    info!("Deployment request received for project: {}", req.project_id);

    match deploy_contract(&req.user_id, &req.project_id, req.account_id.as_deref()).await {
        Ok(deploy_result) => {
            info!("Deployment completed for project: {}", req.project_id);
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