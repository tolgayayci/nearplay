use base64::{engine::general_purpose::STANDARD, Engine as _};
use reqwest::Client;
use serde::Deserialize;
use anyhow::Result;

/// GitHub API service for publishing contract source code
pub struct GitHubService {
    client: Client,
    token: String,
    org: String,
}

#[derive(Debug, Deserialize)]
pub struct RepoResponse {
    pub html_url: String,
    pub full_name: String,
}

impl GitHubService {
    pub fn new(token: String, org: String) -> Self {
        Self {
            client: Client::new(),
            token,
            org,
        }
    }

    /// Create a new repo and push source files
    pub async fn publish_contract_source(
        &self,
        contract_id: &str,
        files: Vec<(String, String)>, // (path, content)
    ) -> Result<RepoResponse> {
        // Sanitize repo name (replace dots with dashes)
        let repo_name = contract_id.replace('.', "-");

        // 1. Create repository
        let repo = self.create_repo(&repo_name, contract_id).await?;

        // 2. Push all files
        for (path, content) in files {
            self.create_or_update_file(&repo_name, &path, &content, contract_id).await?;
        }

        Ok(repo)
    }

    async fn create_repo(&self, name: &str, contract_id: &str) -> Result<RepoResponse> {
        let url = format!("https://api.github.com/orgs/{}/repos", self.org);

        let body = serde_json::json!({
            "name": name,
            "description": format!("NEAR Contract: {} - Published via NEAR Playground", contract_id),
            "private": false,
            "auto_init": false
        });

        let response = self.client
            .post(&url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", "NEAR-Playground")
            .header("Accept", "application/vnd.github+json")
            .json(&body)
            .send()
            .await?;

        // 422 means repo already exists
        if response.status().as_u16() == 422 {
            return self.get_repo(name).await;
        }

        if !response.status().is_success() {
            let status = response.status();
            let error = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("GitHub API error ({}): {}", status, error));
        }

        Ok(response.json().await?)
    }

    async fn get_repo(&self, name: &str) -> Result<RepoResponse> {
        let url = format!("https://api.github.com/repos/{}/{}", self.org, name);

        let response = self.client
            .get(&url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", "NEAR-Playground")
            .header("Accept", "application/vnd.github+json")
            .send()
            .await?;

        if !response.status().is_success() {
            let error = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Failed to get repo: {}", error));
        }

        Ok(response.json().await?)
    }

    async fn create_or_update_file(
        &self,
        repo: &str,
        path: &str,
        content: &str,
        contract_id: &str,
    ) -> Result<()> {
        let url = format!(
            "https://api.github.com/repos/{}/{}/contents/{}",
            self.org, repo, path
        );

        // Check if file exists (to get SHA for update)
        let existing_sha = self.get_file_sha(&url).await.ok();

        let encoded_content = STANDARD.encode(content);

        let mut body = serde_json::json!({
            "message": format!("Add {} for contract {}", path, contract_id),
            "content": encoded_content,
            "committer": {
                "name": "NEAR Playground",
                "email": "tolga+nearplay@yk-labs.com"
            },
            "author": {
                "name": "NEAR Playground",
                "email": "tolga+nearplay@yk-labs.com"
            }
        });

        if let Some(sha) = existing_sha {
            body["sha"] = serde_json::Value::String(sha);
        }

        let response = self.client
            .put(&url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", "NEAR-Playground")
            .header("Accept", "application/vnd.github+json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error = response.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("Failed to create file {}: {}", path, error));
        }

        Ok(())
    }

    async fn get_file_sha(&self, url: &str) -> Result<String> {
        let response = self.client
            .get(url)
            .header("Authorization", format!("Bearer {}", self.token))
            .header("User-Agent", "NEAR-Playground")
            .header("Accept", "application/vnd.github+json")
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(anyhow::anyhow!("File not found"));
        }

        let data: serde_json::Value = response.json().await?;
        data["sha"]
            .as_str()
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow::anyhow!("No SHA found"))
    }
}
