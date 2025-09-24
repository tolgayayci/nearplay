use anyhow::{Context, Result};
use log::{debug, error, info, warn};
use serde_json;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::time::Instant;

use crate::models::{CompileDetails, CompileResponse};

pub async fn compile_contract(
    code: &str,
    user_id: &str,
    project_id: &str,
) -> Result<CompileResponse> {
    let start_time = Instant::now();
    
    // Use persistent project directory structure
    let base_project_path = PathBuf::from("base_project");
    let user_projects_dir = PathBuf::from("projects").join(user_id);
    let project_path = user_projects_dir.join(project_id);
    
    info!(
        "Starting compilation for project {} in persistent directory: {:?}",
        project_id, project_path
    );

    // Ensure the project exists (copy from base if needed)
    setup_user_project(&base_project_path, &project_path, code)?;

    // Run cargo near build
    let compile_result = run_cargo_near_build(&project_path)?;
    
    let compilation_time = start_time.elapsed().as_secs_f64();
    
    // Extract WASM file size and metadata
    let (wasm_size, abi) = extract_compilation_artifacts(&project_path)?;
    
    let response = CompileResponse {
        success: compile_result.status.success(),
        exit_code: compile_result.status.code().unwrap_or(-1),
        stdout: String::from_utf8_lossy(&compile_result.stdout).to_string(),
        stderr: String::from_utf8_lossy(&compile_result.stderr).to_string(),
        details: CompileDetails {
            status: if compile_result.status.success() {
                "success".to_string()
            } else {
                "failed".to_string()
            },
            compilation_time,
            project_path: project_path.to_string_lossy().to_string(),
            wasm_size,
            optimized: true, // cargo-near builds optimized by default
        },
        abi,
    };

    info!(
        "Compilation completed for project {} in {:.2}s",
        project_id, compilation_time
    );

    Ok(response)
}

fn setup_user_project(base_project_path: &PathBuf, project_path: &PathBuf, code: &str) -> Result<()> {
    // Check if user project already exists
    if !project_path.exists() {
        info!("Creating new project by copying base project template");
        
        // Create parent directory
        if let Some(parent) = project_path.parent() {
            fs::create_dir_all(parent).context("Failed to create user projects directory")?;
        }
        
        // Copy entire base project
        copy_dir_all(base_project_path, project_path)
            .context("Failed to copy base project template")?;
        
        debug!("Base project copied to: {:?}", project_path);
    }
    
    // Always update lib.rs with user's code
    let lib_rs_path = project_path.join("src").join("lib.rs");
    fs::write(&lib_rs_path, code)
        .context("Failed to write user contract code")?;
    
    debug!("Updated lib.rs with user code");
    Ok(())
}

// Helper function to recursively copy directories
fn copy_dir_all(src: &PathBuf, dst: &PathBuf) -> Result<()> {
    fs::create_dir_all(dst).context("Failed to create destination directory")?;
    
    for entry in fs::read_dir(src).context("Failed to read source directory")? {
        let entry = entry.context("Failed to read directory entry")?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        
        if src_path.is_dir() {
            // Skip target directory and .git directory to avoid copying build artifacts
            if let Some(dir_name) = src_path.file_name() {
                if dir_name == "target" || dir_name == ".git" {
                    continue;
                }
            }
            copy_dir_all(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path)
                .with_context(|| format!("Failed to copy file: {:?}", src_path))?;
        }
    }
    
    Ok(())
}

fn run_cargo_near_build(project_path: &PathBuf) -> Result<std::process::Output> {
    debug!("Running cargo near build non-reproducible-wasm in directory: {:?}", project_path);
    
    let output = Command::new("cargo")
        .arg("near")
        .arg("build")
        .arg("non-reproducible-wasm")
        .current_dir(project_path)
        .output()
        .context("Failed to execute cargo near build")?;

    debug!(
        "cargo near build completed with exit code: {:?}",
        output.status.code()
    );

    Ok(output)
}

fn extract_compilation_artifacts(project_path: &PathBuf) -> Result<(Option<u64>, Option<serde_json::Value>)> {
    // Look for WASM file in target/near directory
    let near_dir = project_path.join("target").join("near");

    let wasm_size = if near_dir.exists() {
        // Find .wasm files
        let wasm_files: Vec<_> = fs::read_dir(&near_dir)
            .context("Failed to read near target directory")?
            .filter_map(|entry| {
                let entry = entry.ok()?;
                let path = entry.path();
                if path.extension()? == "wasm" {
                    Some(path)
                } else {
                    None
                }
            })
            .collect();

        if let Some(wasm_file) = wasm_files.first() {
            fs::metadata(wasm_file)
                .map(|metadata| metadata.len())
                .ok()
        } else {
            warn!("No WASM file found in target/near directory");
            None
        }
    } else {
        warn!("target/near directory not found");
        None
    };

    // Read actual NEAR ABI file generated by cargo-near - NO FALLBACKS
    let abi = if near_dir.exists() {
        // Find ABI JSON files
        let abi_files: Vec<_> = fs::read_dir(&near_dir)
            .context("Failed to read near target directory")?
            .filter_map(|entry| {
                let entry = entry.ok()?;
                let path = entry.path();
                if path.extension()? == "json" && path.file_name()?.to_str()?.ends_with("_abi.json") {
                    Some(path)
                } else {
                    None
                }
            })
            .collect();

        if let Some(abi_file) = abi_files.first() {
            info!("Reading NEAR ABI from: {:?}", abi_file);
            match fs::read_to_string(abi_file) {
                Ok(abi_content) => {
                    match serde_json::from_str::<serde_json::Value>(&abi_content) {
                        Ok(abi_json) => {
                            info!("Successfully parsed NEAR ABI");
                            Some(abi_json)
                        }
                        Err(e) => {
                            error!("Failed to parse NEAR ABI JSON: {}", e);
                            None
                        }
                    }
                }
                Err(e) => {
                    error!("Failed to read NEAR ABI file: {}", e);
                    None
                }
            }
        } else {
            warn!("No NEAR ABI file found");
            None
        }
    } else {
        warn!("target/near directory not found");
        None
    };

    Ok((wasm_size, abi))
}

// Removed - no longer needed since we only read actual ABI files