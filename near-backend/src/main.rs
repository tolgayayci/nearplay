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
};
use services::filesystem::FileSystemService;
use services::terminal::TerminalService;
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
    let terminal_service = Arc::new(TerminalService::new(projects_path));

    HttpServer::new(move || {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .app_data(web::Data::new(fs_service.clone()))
            .app_data(web::Data::new(terminal_service.clone()))
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
            // WebSocket terminal
            .route("/ws/terminal", web::get().to(terminal_ws_handler))
    })
    .bind(&bind_address)?
    .run()
    .await
}