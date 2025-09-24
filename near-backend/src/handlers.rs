use actix_web::{web, HttpResponse, Result};
use log::{error, info};

use crate::models::{
    ApiResponse, CompileRequest, CompileResponse, DeployRequest, DeployResponse, HealthResponse,
    MethodCallRequest, MethodCallResponse,
};
use crate::services::{compilation::compile_contract, deployment::deploy_contract, method_call::call_contract_method};

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