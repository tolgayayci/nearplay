use actix_cors::Cors;
use actix_web::{middleware::Logger, web, App, HttpServer};
use env_logger::Env;
use log::{info, warn, error};
use std::path::Path;
use std::process::Command;
use std::env;

mod handlers;
mod models;
mod services;
mod utils;

use handlers::{compile_handler, deploy_handler, health_handler, method_call_handler};

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

    HttpServer::new(|| {
        let cors = Cors::default()
            .allow_any_origin()
            .allow_any_method()
            .allow_any_header()
            .supports_credentials();

        App::new()
            .wrap(cors)
            .wrap(Logger::default())
            .route("/health", web::get().to(health_handler))
            .route("/compile", web::post().to(compile_handler))
            .route("/deploy", web::post().to(deploy_handler))
            .route("/method-call", web::post().to(method_call_handler))
    })
    .bind(&bind_address)?
    .run()
    .await
}