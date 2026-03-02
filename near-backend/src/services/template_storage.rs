use anyhow::{Context, Result};
use log::{info, warn, error};
use std::path::{Path, PathBuf};
use std::process::Command;
use tokio::fs;
use tokio::io::AsyncReadExt;

use super::filesystem::{FileNode, FileContent};

const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB max file size
const MAX_TREE_DEPTH: usize = 10;

/// Official NEAR example templates to be seeded on startup
pub struct OfficialTemplate {
    pub id: &'static str,
    pub name: &'static str,
    pub github_url: &'static str,
    pub branch: &'static str,
    pub path: Option<&'static str>,
}

pub const OFFICIAL_TEMPLATES: &[OfficialTemplate] = &[
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000001",
        name: "Counter",
        github_url: "https://github.com/near-examples/counters",
        branch: "main",
        path: Some("contract-rs"),
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000002",
        name: "Hello World",
        github_url: "https://github.com/near-examples/hello-near-examples",
        branch: "main",
        path: Some("contract-rs"),
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000003",
        name: "Fungible Token",
        github_url: "https://github.com/near-examples/FT",
        branch: "master",
        path: None,
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000004",
        name: "Non-Fungible Token",
        github_url: "https://github.com/near-examples/NFT",
        branch: "master",
        path: None,
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000005",
        name: "Cross Contract Calls",
        github_url: "https://github.com/near-examples/cross-contract-calls",
        branch: "main",
        path: Some("contract-simple-rs"),
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000006",
        name: "NEAR Drop",
        github_url: "https://github.com/near-examples/near-drop",
        branch: "main",
        path: None,
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000007",
        name: "NEAR Indexer",
        github_url: "https://github.com/near-examples/near-indexer",
        branch: "main",
        path: None,
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000008",
        name: "Lake Framework Indexer",
        github_url: "https://github.com/near-examples/indexer-near-lake-framework",
        branch: "main",
        path: Some("rust"),
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000009",
        name: "Storage & Collections",
        github_url: "https://github.com/near-examples/storage-examples",
        branch: "main",
        path: Some("collections-rs"),
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000010",
        name: "Factory Contract",
        github_url: "https://github.com/near-examples/factory-rust",
        branch: "main",
        path: None,
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000011",
        name: "Contract Upgrades",
        github_url: "https://github.com/near-examples/update-migrate-rust",
        branch: "main",
        path: None,
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000012",
        name: "Auction",
        github_url: "https://github.com/near-examples/auctions-tutorial",
        branch: "main",
        path: Some("contract-rs/01-basic-auction"),
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000013",
        name: "Donation",
        github_url: "https://github.com/near-examples/donation-examples",
        branch: "main",
        path: Some("contract-rs"),
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000014",
        name: "Guest Book",
        github_url: "https://github.com/near-examples/guest-book-examples",
        branch: "main",
        path: Some("contract-rs"),
    },
    OfficialTemplate {
        id: "00000000-0000-0000-0000-000000000015",
        name: "Coin Flip",
        github_url: "https://github.com/near-examples/coin-flip-examples",
        branch: "main",
        path: Some("contract-rs"),
    },
];

#[derive(Clone)]
pub struct TemplateStorageService {
    template_storage_path: PathBuf,
    projects_path: PathBuf,
}

impl TemplateStorageService {
    pub fn new(template_storage_path: PathBuf, projects_path: PathBuf) -> Self {
        Self {
            template_storage_path,
            projects_path,
        }
    }

    /// Get the path to a template's storage directory
    pub fn get_template_path(&self, template_id: &str) -> PathBuf {
        self.template_storage_path.join(template_id)
    }

    /// Clone ENTIRE repo/subdirectory from GitHub to template-storage/{template_id}/
    pub async fn clone_from_github(
        &self,
        template_id: &str,
        github_url: &str,
        branch: Option<&str>,
        path: Option<&str>,
    ) -> Result<String> {
        let template_path = self.get_template_path(template_id);
        let temp_path = self.template_storage_path.join(format!("{}_temp", template_id));

        // Ensure template-storage directory exists
        fs::create_dir_all(&self.template_storage_path).await?;

        // Clean up any existing directories
        if template_path.exists() {
            fs::remove_dir_all(&template_path).await?;
        }
        if temp_path.exists() {
            fs::remove_dir_all(&temp_path).await?;
        }

        // Clone the repository
        let branch_str = branch.unwrap_or("main");
        let mut clone_cmd = Command::new("git");
        clone_cmd
            .arg("clone")
            .arg("--depth")
            .arg("1")
            .arg("--branch")
            .arg(branch_str)
            .arg(github_url)
            .arg(&temp_path);

        info!("Cloning template from GitHub: {} (branch: {})", github_url, branch_str);

        let output = clone_cmd.output().context("Failed to execute git clone")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            error!("Git clone failed: {}", stderr);
            return Err(anyhow::anyhow!("Git clone failed: {}", stderr));
        }

        // Remove .git directory
        let git_dir = temp_path.join(".git");
        if git_dir.exists() {
            fs::remove_dir_all(&git_dir).await?;
        }

        // If a specific path is requested, extract only that subdirectory
        if let Some(subpath) = path {
            let source_path = temp_path.join(subpath);
            if !source_path.exists() {
                fs::remove_dir_all(&temp_path).await?;
                return Err(anyhow::anyhow!("Path '{}' not found in repository", subpath));
            }

            // Move the subdirectory to the final location
            self.move_dir_contents(&source_path, &template_path).await?;
            fs::remove_dir_all(&temp_path).await?;
        } else {
            // Move entire repo to template path
            fs::rename(&temp_path, &template_path).await?;
        }

        // Clean up target directory if it exists
        let target_dir = template_path.join("target");
        if target_dir.exists() {
            fs::remove_dir_all(&target_dir).await?;
        }

        info!("Template {} cloned successfully to {:?}", template_id, template_path);
        Ok(template_path.to_string_lossy().to_string())
    }

    /// Copy ENTIRE project directory to template-storage/{template_id}/
    pub async fn copy_from_project(
        &self,
        template_id: &str,
        user_id: &str,
        project_id: &str,
    ) -> Result<String> {
        let project_path = self.projects_path.join(user_id).join(project_id);
        let template_path = self.get_template_path(template_id);

        if !project_path.exists() {
            return Err(anyhow::anyhow!("Project not found: {}/{}", user_id, project_id));
        }

        // Ensure template-storage directory exists
        fs::create_dir_all(&self.template_storage_path).await?;

        // Clean up any existing template directory
        if template_path.exists() {
            fs::remove_dir_all(&template_path).await?;
        }

        // Copy project to template storage
        info!("Copying project {}/{} to template {}", user_id, project_id, template_id);
        self.copy_dir_all(&project_path, &template_path).await?;

        // Clean up target directory if it exists
        let target_dir = template_path.join("target");
        if target_dir.exists() {
            fs::remove_dir_all(&target_dir).await?;
        }

        info!("Template {} created from project at {:?}", template_id, template_path);
        Ok(template_path.to_string_lossy().to_string())
    }

    /// Get file tree for template preview
    pub async fn get_file_tree(&self, template_id: &str) -> Result<FileNode> {
        let template_path = self.get_template_path(template_id);

        if !template_path.exists() {
            return Err(anyhow::anyhow!("Template storage not found: {}", template_id));
        }

        let mut tree = self.build_tree(&template_path, &template_path, 0, MAX_TREE_DEPTH).await?;
        tree.name = template_id.to_string();
        Ok(tree)
    }

    /// Get specific file content for preview
    pub async fn get_file(&self, template_id: &str, file_path: &str) -> Result<FileContent> {
        let template_path = self.get_template_path(template_id);
        let full_path = template_path.join(file_path.trim_start_matches('/'));

        if !template_path.exists() {
            return Err(anyhow::anyhow!("Template storage not found: {}", template_id));
        }

        // Security check: ensure path is within template directory
        let canonical_template = template_path.canonicalize().unwrap_or(template_path.clone());
        let canonical_file = full_path.canonicalize()?;
        if !canonical_file.starts_with(&canonical_template) {
            return Err(anyhow::anyhow!("Invalid file path: path traversal detected"));
        }

        let metadata = fs::metadata(&full_path).await?;
        if metadata.len() > MAX_FILE_SIZE {
            return Err(anyhow::anyhow!("File too large (max {}MB)", MAX_FILE_SIZE / 1024 / 1024));
        }

        let mut file = fs::File::open(&full_path).await?;
        let mut content = String::new();
        file.read_to_string(&mut content).await?;

        Ok(FileContent {
            path: file_path.to_string(),
            content,
            size: metadata.len(),
            modified: chrono::DateTime::from(metadata.modified()?),
        })
    }

    /// Copy ENTIRE template directory to new user project
    pub async fn use_template(
        &self,
        template_id: &str,
        user_id: &str,
        new_project_id: &str,
    ) -> Result<PathBuf> {
        let template_path = self.get_template_path(template_id);
        let project_path = self.projects_path.join(user_id).join(new_project_id);

        if !template_path.exists() {
            return Err(anyhow::anyhow!("Template storage not found: {}", template_id));
        }

        // Ensure user's projects directory exists
        let user_projects_path = self.projects_path.join(user_id);
        fs::create_dir_all(&user_projects_path).await?;

        // If project already exists, return error
        if project_path.exists() {
            return Err(anyhow::anyhow!("Project already exists: {}", new_project_id));
        }

        // Copy template to project
        info!("Creating project {}/{} from template {}", user_id, new_project_id, template_id);
        self.copy_dir_all(&template_path, &project_path).await?;

        info!("Project created at {:?}", project_path);
        Ok(project_path)
    }

    /// Delete template storage directory
    pub async fn delete_template(&self, template_id: &str) -> Result<()> {
        let template_path = self.get_template_path(template_id);

        if template_path.exists() {
            info!("Deleting template storage: {}", template_id);
            fs::remove_dir_all(&template_path).await?;
        } else {
            warn!("Template storage not found for deletion: {}", template_id);
        }

        Ok(())
    }

    /// Check if template storage exists
    pub async fn template_exists(&self, template_id: &str) -> bool {
        self.get_template_path(template_id).exists()
    }

    /// Get main code file (src/lib.rs) content for quick preview
    pub async fn get_main_code(&self, template_id: &str) -> Result<String> {
        let template_path = self.get_template_path(template_id);

        // Try common main file locations
        let possible_paths = [
            "src/lib.rs",
            "lib.rs",
            "src/main.rs",
            "main.rs",
        ];

        for rel_path in possible_paths {
            let file_path = template_path.join(rel_path);
            if file_path.exists() {
                let content = fs::read_to_string(&file_path).await?;
                return Ok(content);
            }
        }

        Err(anyhow::anyhow!("No main code file found in template"))
    }

    // Helper: Build file tree recursively
    async fn build_tree(&self, path: &Path, root: &Path, depth: usize, max_depth: usize) -> Result<FileNode> {
        let metadata = fs::metadata(path).await?;
        let name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
        let relative_path = if path == root {
            String::new()
        } else {
            path.strip_prefix(root).unwrap_or(path).to_string_lossy().to_string()
        };

        if metadata.is_dir() {
            let mut children = Vec::new();

            if depth < max_depth {
                let mut entries = fs::read_dir(path).await?;

                while let Some(entry) = entries.next_entry().await? {
                    let entry_name = entry.file_name().to_string_lossy().to_string();

                    // Skip build and hidden directories
                    if matches!(entry_name.as_str(),
                        "target" | "node_modules" | "dist" | "build" | ".git" |
                        ".next" | "out" | "coverage" | ".turbo" | "__pycache__"
                    ) {
                        continue;
                    }

                    // Skip most hidden files
                    if entry_name.starts_with('.') && !matches!(entry_name.as_str(),
                        ".github" | ".gitignore" | ".gitattributes" | ".cargo"
                    ) {
                        continue;
                    }

                    if let Ok(child) = Box::pin(self.build_tree(&entry.path(), root, depth + 1, max_depth)).await {
                        children.push(child);
                    }
                }

                // Sort: directories first, then alphabetical
                children.sort_by(|a, b| {
                    match (a.is_directory, b.is_directory) {
                        (true, false) => std::cmp::Ordering::Less,
                        (false, true) => std::cmp::Ordering::Greater,
                        _ => a.name.cmp(&b.name),
                    }
                });
            }

            Ok(FileNode {
                name,
                path: relative_path,
                is_directory: true,
                children: Some(children),
                size: None,
                modified: None,
            })
        } else {
            Ok(FileNode {
                name,
                path: relative_path,
                is_directory: false,
                children: None,
                size: Some(metadata.len()),
                modified: Some(chrono::DateTime::from(metadata.modified()?)),
            })
        }
    }

    // Helper: Copy directory recursively
    async fn copy_dir_all(&self, src: &Path, dst: &Path) -> Result<()> {
        fs::create_dir_all(dst).await?;

        let mut entries = fs::read_dir(src).await?;

        while let Some(entry) = entries.next_entry().await? {
            let ty = entry.file_type().await?;
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            let name = entry.file_name().to_string_lossy().to_string();

            // Skip target directory, .git, and node_modules
            if matches!(name.as_str(), "target" | ".git" | "node_modules") {
                continue;
            }

            if ty.is_dir() {
                Box::pin(self.copy_dir_all(&src_path, &dst_path)).await?;
            } else {
                fs::copy(&src_path, &dst_path).await?;
            }
        }

        Ok(())
    }

    // Helper: Move directory contents
    async fn move_dir_contents(&self, src: &Path, dst: &Path) -> Result<()> {
        fs::create_dir_all(dst).await?;

        let mut entries = fs::read_dir(src).await?;

        while let Some(entry) = entries.next_entry().await? {
            let src_path = entry.path();
            let dst_path = dst.join(entry.file_name());

            fs::rename(&src_path, &dst_path).await?;
        }

        Ok(())
    }

    /// Seed official templates from GitHub on startup
    /// Only clones templates that don't already exist in template-storage
    pub async fn seed_official_templates(&self) -> Result<()> {
        info!("Checking official templates...");

        for template in OFFICIAL_TEMPLATES {
            if self.template_exists(template.id).await {
                info!("Official template '{}' already exists, skipping", template.name);
                continue;
            }

            info!("Seeding official template '{}' from GitHub...", template.name);

            match self.clone_from_github(
                template.id,
                template.github_url,
                Some(template.branch),
                template.path,
            ).await {
                Ok(path) => {
                    info!("Successfully seeded official template '{}' to {}", template.name, path);
                }
                Err(e) => {
                    error!("Failed to seed official template '{}': {}", template.name, e);
                    // Continue with other templates even if one fails
                }
            }
        }

        info!("Official templates seeding complete");
        Ok(())
    }
}
