use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::io::AsyncReadExt;
use walkdir::WalkDir;

const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB max file size
const MAX_TREE_DEPTH: usize = 10;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileNode>>,
    pub size: Option<u64>,
    pub modified: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
    pub size: u64,
    pub modified: chrono::DateTime<chrono::Utc>,
}

#[derive(Clone)]
pub struct FileSystemService {
    projects_path: PathBuf,
    base_project_path: PathBuf,
}

impl FileSystemService {
    pub fn new(projects_path: PathBuf, base_project_path: PathBuf) -> Self {
        Self {
            projects_path,
            base_project_path,
        }
    }

    /// Initialize a new project by copying the base project template
    /// If initial_code is provided, it will be written to src/lib.rs
    pub async fn init_project(
        &self,
        user_id: &str,
        project_id: &str,
        initial_code: Option<&str>,
    ) -> Result<PathBuf> {
        let user_path = self.projects_path.join(user_id);
        fs::create_dir_all(&user_path).await?;

        let project_path = self.get_project_path(user_id, project_id);

        // If project already exists, just return the path
        if project_path.exists() {
            return Ok(project_path);
        }

        // Copy base_project template to new project
        copy_dir_all(&self.base_project_path, &project_path).await?;

        // If initial code is provided, write it to src/lib.rs
        if let Some(code) = initial_code {
            let lib_path = project_path.join("src").join("lib.rs");
            fs::write(&lib_path, code).await?;
            log::info!("Wrote initial code to {:?}", lib_path);
        }

        log::info!("Initialized project at {:?}", project_path);
        Ok(project_path)
    }

    /// Get the file tree for a project
    pub async fn get_project_tree(&self, user_id: &str, project_id: &str) -> Result<FileNode> {
        let project_path = self.get_project_path(user_id, project_id);

        // Initialize project if it doesn't exist
        if !project_path.exists() {
            self.init_project(user_id, project_id, None).await?;
        }

        let mut tree = self.build_tree(&project_path, &project_path, 0, MAX_TREE_DEPTH).await?;
        // Set the root name to project_id for better display
        tree.name = project_id.to_string();
        Ok(tree)
    }

    async fn build_tree(&self, path: &Path, project_root: &Path, depth: usize, max_depth: usize) -> Result<FileNode> {
        let metadata = fs::metadata(path).await?;
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Calculate relative path from project root
        let relative_path = if path == project_root {
            String::new() // Root should have empty path
        } else {
            path.strip_prefix(project_root)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string()
        };

        if metadata.is_dir() {
            let mut children = Vec::new();

            // Stop recursion at max depth
            if depth >= max_depth {
                return Ok(FileNode {
                    name,
                    path: relative_path,
                    is_directory: true,
                    children: Some(children),
                    size: None,
                    modified: None,
                });
            }

            let mut entries = fs::read_dir(path).await?;

            while let Some(entry) = entries.next_entry().await? {
                let entry_name = entry.file_name().to_string_lossy().to_string();

                // Skip build and dependency directories
                if matches!(entry_name.as_str(),
                    "target" | "node_modules" | "dist" | "build" | ".next" |
                    "out" | "coverage" | ".turbo" | ".parcel-cache" | "__pycache__"
                ) {
                    continue;
                }

                // Skip most hidden files/directories but allow important ones
                if entry_name.starts_with('.') && !matches!(entry_name.as_str(),
                    ".github" | ".gitignore" | ".gitattributes" | ".env.example" |
                    ".dockerignore" | ".cargo"
                ) {
                    continue;
                }

                // Recursively build tree for valid entries
                if let Ok(child) = Box::pin(self.build_tree(&entry.path(), project_root, depth + 1, max_depth)).await {
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

    /// Read a file's content
    pub async fn read_file(&self, user_id: &str, project_id: &str, file_path: &str) -> Result<FileContent> {
        let project_path = self.get_project_path(user_id, project_id);
        let full_path = project_path.join(file_path.trim_start_matches('/'));

        // Security check: ensure path is within project directory
        let canonical_project = project_path.canonicalize().unwrap_or(project_path.clone());
        let canonical_file = full_path.canonicalize()?;
        if !canonical_file.starts_with(&canonical_project) {
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

    /// Write content to a file
    pub async fn write_file(
        &self,
        user_id: &str,
        project_id: &str,
        file_path: &str,
        content: &str,
    ) -> Result<FileContent> {
        let project_path = self.get_project_path(user_id, project_id);
        let full_path = project_path.join(file_path.trim_start_matches('/'));

        // Security check: ensure we're not writing outside project directory
        // For new files, check the parent directory
        let check_path = if full_path.exists() {
            full_path.clone()
        } else {
            full_path.parent().unwrap_or(&project_path).to_path_buf()
        };

        if check_path.exists() {
            let canonical_project = project_path.canonicalize().unwrap_or(project_path.clone());
            let canonical_check = check_path.canonicalize()?;
            if !canonical_check.starts_with(&canonical_project) {
                return Err(anyhow::anyhow!("Invalid file path: path traversal detected"));
            }
        }

        // Check file size
        if content.len() as u64 > MAX_FILE_SIZE {
            return Err(anyhow::anyhow!("File content too large (max {}MB)", MAX_FILE_SIZE / 1024 / 1024));
        }

        // Create parent directories if needed
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::write(&full_path, content).await?;

        let metadata = fs::metadata(&full_path).await?;
        Ok(FileContent {
            path: file_path.to_string(),
            content: content.to_string(),
            size: metadata.len(),
            modified: chrono::DateTime::from(metadata.modified()?),
        })
    }

    /// Create an empty file
    pub async fn create_file(
        &self,
        user_id: &str,
        project_id: &str,
        file_path: &str,
    ) -> Result<FileContent> {
        self.write_file(user_id, project_id, file_path, "").await
    }

    /// Delete a file or directory
    pub async fn delete_file(&self, user_id: &str, project_id: &str, file_path: &str) -> Result<()> {
        let project_path = self.get_project_path(user_id, project_id);
        let full_path = project_path.join(file_path.trim_start_matches('/'));

        // Security check
        let canonical_project = project_path.canonicalize().unwrap_or(project_path.clone());
        let canonical_file = full_path.canonicalize()?;
        if !canonical_file.starts_with(&canonical_project) {
            return Err(anyhow::anyhow!("Invalid file path: path traversal detected"));
        }

        // Prevent deleting critical files
        let path_lower = file_path.to_lowercase();
        if path_lower == "cargo.toml" || path_lower == "src/lib.rs" {
            return Err(anyhow::anyhow!("Cannot delete critical project files"));
        }

        if full_path.is_dir() {
            fs::remove_dir_all(&full_path).await?;
        } else {
            fs::remove_file(&full_path).await?;
        }

        Ok(())
    }

    /// Rename/move a file or directory
    pub async fn rename_file(
        &self,
        user_id: &str,
        project_id: &str,
        old_path: &str,
        new_path: &str,
    ) -> Result<()> {
        let project_path = self.get_project_path(user_id, project_id);
        let old_full_path = project_path.join(old_path.trim_start_matches('/'));
        let new_full_path = project_path.join(new_path.trim_start_matches('/'));

        // Security checks
        let canonical_project = project_path.canonicalize().unwrap_or(project_path.clone());
        let canonical_old = old_full_path.canonicalize()?;

        if !canonical_old.starts_with(&canonical_project) {
            return Err(anyhow::anyhow!("Invalid source path: path traversal detected"));
        }

        // For new path, check parent directory
        if let Some(new_parent) = new_full_path.parent() {
            if new_parent.exists() {
                let canonical_new_parent = new_parent.canonicalize()?;
                if !canonical_new_parent.starts_with(&canonical_project) {
                    return Err(anyhow::anyhow!("Invalid destination path: path traversal detected"));
                }
            }
        }

        // Create parent directories for new path if needed
        if let Some(parent) = new_full_path.parent() {
            fs::create_dir_all(parent).await?;
        }

        fs::rename(&old_full_path, &new_full_path).await?;
        Ok(())
    }

    /// Create a directory
    pub async fn create_directory(
        &self,
        user_id: &str,
        project_id: &str,
        dir_path: &str,
    ) -> Result<()> {
        let project_path = self.get_project_path(user_id, project_id);
        let full_path = project_path.join(dir_path.trim_start_matches('/'));

        // Security check - validate parent exists and is in project
        if let Some(parent) = full_path.parent() {
            if parent.exists() {
                let canonical_project = project_path.canonicalize().unwrap_or(project_path.clone());
                let canonical_parent = parent.canonicalize()?;
                if !canonical_parent.starts_with(&canonical_project) {
                    return Err(anyhow::anyhow!("Invalid directory path: path traversal detected"));
                }
            }
        }

        fs::create_dir_all(&full_path).await?;
        Ok(())
    }

    /// Move a file or directory
    pub async fn move_file(
        &self,
        user_id: &str,
        project_id: &str,
        source_path: &str,
        destination_path: &str,
    ) -> Result<()> {
        self.rename_file(user_id, project_id, source_path, destination_path).await
    }

    /// Get total size of a project
    pub async fn get_project_size(&self, user_id: &str, project_id: &str) -> Result<u64> {
        let project_path = self.get_project_path(user_id, project_id);
        let mut total_size = 0u64;

        for entry in WalkDir::new(&project_path) {
            if let Ok(entry) = entry {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        total_size += metadata.len();
                    }
                }
            }
        }

        Ok(total_size)
    }

    /// Get the path to a project directory
    pub fn get_project_path(&self, user_id: &str, project_id: &str) -> PathBuf {
        self.projects_path.join(user_id).join(project_id)
    }

    /// Check if a project exists
    pub async fn project_exists(&self, user_id: &str, project_id: &str) -> bool {
        self.get_project_path(user_id, project_id).exists()
    }

    /// Search files in a project by filename or content
    pub async fn search_files(
        &self,
        user_id: &str,
        project_id: &str,
        query: &str,
        search_content: bool,
    ) -> Result<Vec<crate::models::FileSearchResult>> {
        let project_path = self.get_project_path(user_id, project_id);

        // Initialize project if it doesn't exist
        if !project_path.exists() {
            self.init_project(user_id, project_id, None).await?;
        }

        let mut results = Vec::new();
        let query_lower = query.to_lowercase();
        let max_results = 100;

        for entry in WalkDir::new(&project_path)
            .max_depth(MAX_TREE_DEPTH)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                // Skip build and hidden directories
                !matches!(name.as_ref(),
                    "target" | "node_modules" | "dist" | "build" | ".git" |
                    ".next" | "out" | "coverage" | ".turbo" | "__pycache__"
                )
            })
            .filter_map(|e| e.ok())
        {
            if results.len() >= max_results {
                break;
            }

            let path = entry.path();
            if !path.is_file() {
                continue;
            }

            let relative_path = path
                .strip_prefix(&project_path)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            let name = path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // Check filename match
            if name.to_lowercase().contains(&query_lower)
                || relative_path.to_lowercase().contains(&query_lower)
            {
                results.push(crate::models::FileSearchResult {
                    path: relative_path.clone(),
                    name: name.clone(),
                    preview: None,
                    line_number: None,
                });
                continue;
            }

            // Content search if enabled
            if search_content {
                // Skip binary files and large files
                if let Ok(metadata) = std::fs::metadata(path) {
                    if metadata.len() > 1024 * 1024 {
                        // Skip files > 1MB for content search
                        continue;
                    }
                }

                // Check if it's likely a text file
                let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
                let text_extensions = [
                    "rs", "toml", "md", "txt", "json", "yml", "yaml", "sh", "bash",
                    "js", "ts", "jsx", "tsx", "css", "html", "xml", "svg", "lock",
                    "gitignore", "env", "cfg", "ini", "conf",
                ];

                if !text_extensions.contains(&ext.to_lowercase().as_str())
                    && !name.starts_with('.')
                    && ext != ""
                {
                    continue;
                }

                if let Ok(content) = std::fs::read_to_string(path) {
                    for (line_num, line) in content.lines().enumerate() {
                        if line.to_lowercase().contains(&query_lower) {
                            // Create preview: trim whitespace and limit length
                            let preview = line.trim();
                            let preview = if preview.len() > 100 {
                                format!("{}...", &preview[..100])
                            } else {
                                preview.to_string()
                            };

                            results.push(crate::models::FileSearchResult {
                                path: relative_path.clone(),
                                name: name.clone(),
                                preview: Some(preview),
                                line_number: Some(line_num + 1),
                            });
                            break; // One result per file for content matches
                        }
                    }
                }
            }
        }

        Ok(results)
    }
}

/// Recursively copy a directory, excluding target and .git directories
async fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(dst).await?;

    let mut entries = fs::read_dir(src).await?;

    while let Some(entry) = entries.next_entry().await? {
        let ty = entry.file_type().await?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        let name = entry.file_name().to_string_lossy().to_string();

        // Skip target directory and .git
        if name == "target" || name == ".git" {
            continue;
        }

        if ty.is_dir() {
            Box::pin(copy_dir_all(&src_path, &dst_path)).await?;
        } else {
            fs::copy(&src_path, &dst_path).await?;
        }
    }

    Ok(())
}
