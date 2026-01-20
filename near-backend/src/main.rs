use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer, HttpRequest, HttpResponse, Error};
use actix_web_actors::ws;
use env_logger::Env;
use log::{info, warn, error};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use std::env;

mod handlers;
mod models;
mod services;
mod utils;
mod websocket;

use handlers::{
    compile_handler, deploy_handler, health_handler, method_call_handler,
    filesystem_tree_handler, filesystem_read_handler, filesystem_write_handler,
    filesystem_create_handler, filesystem_delete_handler, filesystem_rename_handler,
    filesystem_mkdir_handler, filesystem_move_handler, project_init_handler,
    filesystem_search_handler,
    verification_package_handler, verification_metadata_handler,
    publish_source_handler, check_verification_status_handler, verify_contract_handler,
    get_wasm_handler,
    github_clone_handler, project_export_handler,
    faucet_request_handler, faucet_status_handler, faucet_history_handler,
    template_create_from_github_handler, template_create_from_project_handler,
    template_use_handler, template_files_handler, template_file_content_handler,
    template_main_code_handler, template_delete_handler,
};
use services::filesystem::FileSystemService;
use services::terminal::TerminalService;
use services::verification::VerificationService;
use services::github::GitHubService;
use services::template_storage::TemplateStorageService;
use websocket::TerminalWsSession;

async fn initialize_base_project() -> std::io::Result<()> {
    let base_project_path = Path::new("base_project");
    
    if !base_project_path.exists() {
        info!("Base project not found, creating it...");
        
        let output = Command::new("cargo")
            .arg("near")
            .arg("new")
            .arg("base_project")
            .output()?;
            
        if !output.status.success() {
            error!("Failed to create base project: {}", String::from_utf8_lossy(&output.stderr));
            return Err(std::io::Error::new(
                std::io::ErrorKind::Other,
                "Failed to create base project"
            ));
        }
        
        info!("Base project created successfully");
    }
    
    // Build the base project to cache dependencies
    let target_dir = base_project_path.join("target");
    if !target_dir.exists() {
        info!("Building base project to cache dependencies...");
        
        let output = Command::new("cargo")
            .arg("near")
            .arg("build")
            .arg("non-reproducible-wasm")
            .current_dir(base_project_path)
            .output()?;
            
        if output.status.success() {
            info!("Base project built successfully, dependencies cached");
        } else {
            warn!("Base project build failed, but continuing: {}", String::from_utf8_lossy(&output.stderr));
        }
    } else {
        info!("Base project already built, dependencies available");
    }
    
    Ok(())
}

/// WebSocket handler for terminal connections
async fn terminal_ws_handler(
    req: HttpRequest,
    stream: web::Payload,
    terminal_service: web::Data<Arc<TerminalService>>,
    query: web::Query<TerminalWsQuery>,
) -> Result<HttpResponse, Error> {
    let session_id = uuid::Uuid::new_v4().to_string();

    info!(
        "New terminal WebSocket connection: user={}, project={}",
        query.user_id, query.project_id
    );

    let session = TerminalWsSession::new(
        session_id,
        query.user_id.clone(),
        query.project_id.clone(),
        terminal_service.get_ref().clone(),
    );

    ws::start(session, &req, stream)
}

#[derive(serde::Deserialize)]
struct TerminalWsQuery {
    user_id: String,
    project_id: String,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // Load environment variables from .env file
    dotenv::dotenv().ok();
    
    env_logger::Builder::from_env(Env::default().default_filter_or("info")).init();

    info!("Starting NEAR Playground Backend Server");
    
    // Initialize base project on startup
    initialize_base_project().await?;

    // Get host and port from environment variables
    let host = env::var("HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let port = env::var("PORT").unwrap_or_else(|_| "8080".to_string());
    let bind_address = format!("{}:{}", host, port);

    info!("Starting NEAR Playground Backend on {}", bind_address);

    // Initialize FileSystemService
    let projects_path = PathBuf::from("projects");
    let base_project_path = PathBuf::from("base_project");
    let fs_service = Arc::new(FileSystemService::new(projects_path.clone(), base_project_path));

    // Initialize TerminalService
    let terminal_service = Arc::new(TerminalService::new(projects_path.clone()));

    // Initialize VerificationService
    let verification_service = Arc::new(VerificationService::new(projects_path.clone()));

    // Initialize GitHubService
    let github_token = env::var("GITHUB_TOKEN").ok();
    let github_org = env::var("GITHUB_ORG").unwrap_or_else(|_| "nearplay-contracts".to_string());
    let github_service = github_token.map(|token| {
        info!("GitHub service initialized for org: {}", github_org);
        Arc::new(GitHubService::new(token, github_org))
    });

    // Initialize TemplateStorageService
    let template_storage_path = PathBuf::from("template-storage");
    std::fs::create_dir_all(&template_storage_path).ok();
    let template_service = Arc::new(TemplateStorageService::new(
        template_storage_path,
        projects_path.clone(),
    ));
    info!("Template storage service initialized");

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        let mut app = App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(web::Data::new(fs_service.clone()))
            .app_data(web::Data::new(terminal_service.clone()))
            .app_data(web::Data::new(verification_service.clone()))
            .app_data(web::Data::new(template_service.clone()));

        // Add GitHub service if configured
        if let Some(ref gh_service) = github_service {
            app = app.app_data(web::Data::new(gh_service.clone()));
        }

        app
            // Existing routes
            .route("/health", web::get().to(health_handler))
            .route("/compile", web::post().to(compile_handler))
            .route("/deploy", web::post().to(deploy_handler))
            .route("/method-call", web::post().to(method_call_handler))
            // Filesystem API routes
            .route("/api/filesystem/tree", web::get().to(filesystem_tree_handler))
            .route("/api/filesystem/read", web::post().to(filesystem_read_handler))
            .route("/api/filesystem/write", web::post().to(filesystem_write_handler))
            .route("/api/filesystem/create", web::post().to(filesystem_create_handler))
            .route("/api/filesystem/delete", web::post().to(filesystem_delete_handler))
            .route("/api/filesystem/rename", web::post().to(filesystem_rename_handler))
            .route("/api/filesystem/mkdir", web::post().to(filesystem_mkdir_handler))
            .route("/api/filesystem/move", web::post().to(filesystem_move_handler))
            .route("/api/filesystem/search", web::post().to(filesystem_search_handler))
            // Project initialization
            .route("/api/project/initialize", web::post().to(project_init_handler))
            // Verification API routes
            .route("/api/verification/package", web::post().to(verification_package_handler))
            .route("/api/verification/metadata", web::post().to(verification_metadata_handler))
            .route("/api/verification/status", web::get().to(check_verification_status_handler))
            .route("/api/verification/verify", web::post().to(verify_contract_handler))
            // Source publishing API route
            .route("/api/source/publish", web::post().to(publish_source_handler))
            // WASM download for wallet-based deployment
            .route("/api/wasm/{user_id}/{project_id}", web::get().to(get_wasm_handler))
            // GitHub clone API
            .route("/api/github/clone", web::post().to(github_clone_handler))
            // Project export API
            .route("/api/project/export/{user_id}/{project_id}", web::get().to(project_export_handler))
            // Faucet API routes
            .route("/api/faucet/request", web::post().to(faucet_request_handler))
            .route("/api/faucet/status", web::get().to(faucet_status_handler))
            .route("/api/faucet/history", web::get().to(faucet_history_handler))
            // Template storage API routes
            .route("/api/templates/create/github", web::post().to(template_create_from_github_handler))
            .route("/api/templates/create/project", web::post().to(template_create_from_project_handler))
            .route("/api/templates/use", web::post().to(template_use_handler))
            .route("/api/templates/{template_id}/files", web::get().to(template_files_handler))
            .route("/api/templates/{template_id}/files/{path:.*}", web::get().to(template_file_content_handler))
            .route("/api/templates/{template_id}/code", web::get().to(template_main_code_handler))
            .route("/api/templates/{template_id}", web::delete().to(template_delete_handler))
            // WebSocket terminal
            .route("/ws/terminal", web::get().to(terminal_ws_handler))
    })
    .bind(&bind_address)?
    .run()
    .await
}