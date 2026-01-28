use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, RwLock};
use tokio::time::timeout;
use chrono::{DateTime, Utc};
use anyhow::{Result, anyhow};

/// Command timeout duration (5 minutes)
const COMMAND_TIMEOUT: Duration = Duration::from_secs(300);

/// Default RPC URL to use when none is provided
const DEFAULT_TESTNET_RPC_URL: &str = "https://rpc.testnet.near.org";

/// Message types for terminal WebSocket communication
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(tag = "type")]
pub enum TerminalMessage {
    #[serde(rename = "command")]
    Command {
        command: String,
        session_id: String,
        #[serde(default)]
        rpc_url: Option<String>,
    },
    #[serde(rename = "output")]
    Output {
        data: String,
        stream: String, // "stdout" or "stderr"
    },
    #[serde(rename = "exit")]
    Exit {
        code: i32,
    },
    #[serde(rename = "error")]
    Error {
        message: String,
    },
    #[serde(rename = "ready")]
    Ready,
}

/// Terminal session for a user/project
#[derive(Debug)]
pub struct TerminalSession {
    pub user_id: String,
    pub project_id: String,
    pub working_dir: PathBuf,
    pub created_at: DateTime<Utc>,
    pub last_activity: DateTime<Utc>,
}

/// Terminal service for managing sessions and executing commands
pub struct TerminalService {
    projects_path: PathBuf,
    sessions: RwLock<HashMap<String, TerminalSession>>,
}

impl TerminalService {
    pub fn new(projects_path: PathBuf) -> Self {
        Self {
            projects_path,
            sessions: RwLock::new(HashMap::new()),
        }
    }

    /// Create or get a terminal session
    pub async fn get_or_create_session(
        &self,
        session_id: &str,
        user_id: &str,
        project_id: &str,
    ) -> Result<PathBuf> {
        let mut sessions = self.sessions.write().await;

        if let Some(session) = sessions.get_mut(session_id) {
            session.last_activity = Utc::now();
            return Ok(session.working_dir.clone());
        }

        let working_dir = self.projects_path.join(user_id).join(project_id);

        if !working_dir.exists() {
            return Err(anyhow!("Project directory does not exist"));
        }

        let session = TerminalSession {
            user_id: user_id.to_string(),
            project_id: project_id.to_string(),
            working_dir: working_dir.clone(),
            created_at: Utc::now(),
            last_activity: Utc::now(),
        };

        sessions.insert(session_id.to_string(), session);
        Ok(working_dir)
    }

    /// Validate command for security
    pub fn validate_command(&self, command: &str) -> Result<()> {
        let parts: Vec<&str> = command.split_whitespace().collect();
        if parts.is_empty() {
            return Err(anyhow!("Empty command"));
        }

        let cmd = parts[0];

        // Explicitly forbidden commands
        let forbidden = [
            "rm", "sudo", "su", "chmod", "chown", "mkfs", "dd",
            "wget", "curl", // Prevent arbitrary downloads
            "ssh", "scp", "nc", "netcat", // Network tools
            "kill", "killall", "pkill", // Process management
            "rustup", // Prevent modifying system toolchain
        ];

        if forbidden.contains(&cmd) {
            return Err(anyhow!("Command '{}' is not allowed", cmd));
        }

        // Check for forbidden subcommands
        if cmd == "cargo" && parts.len() > 1 {
            let subcommand = parts[1];
            let forbidden_cargo_subcommands = ["run", "install", "publish"];
            if forbidden_cargo_subcommands.contains(&subcommand) {
                return Err(anyhow!("'cargo {}' is not allowed in the web terminal", subcommand));
            }
        }

        if cmd == "near" && parts.len() > 1 {
            let subcommand = parts[1];
            let forbidden_near_subcommands = ["login", "delete", "deploy"];
            if forbidden_near_subcommands.contains(&subcommand) {
                return Err(anyhow!("'near {}' is not allowed. Use the Deploy button for deployments.", subcommand));
            }
        }

        // Check for shell escape attempts and redirects
        if command.contains(';') || command.contains('|') || command.contains('`') ||
           command.contains("$(") || command.contains("&&") || command.contains("||") ||
           command.contains('>') || command.contains('<') {
            return Err(anyhow!("Shell operators and redirects are not allowed"));
        }

        // Check for background execution
        if command.trim().ends_with('&') {
            return Err(anyhow!("Background execution is not allowed"));
        }

        // Check for path traversal
        if command.contains("..") {
            return Err(anyhow!("Path traversal is not allowed"));
        }

        // Allowed command prefixes
        let allowed_prefixes = [
            "cargo",  // All cargo commands (cargo near, cargo build, cargo test, etc.)
            "near",   // NEAR CLI commands (near view, near call, near state, etc.)
            "ls",
            "pwd",
            "cat",
            "head",
            "tail",
            "tree",
            "rustc",
            "rustfmt",
            "echo",
            "wc",
            "grep",  // For searching in files
        ];

        if !allowed_prefixes.iter().any(|prefix| cmd == *prefix || cmd.starts_with(prefix)) {
            return Err(anyhow!("Command '{}' is not allowed. Allowed: cargo, near, ls, pwd, cat, tree, rustc, rustfmt", cmd));
        }

        Ok(())
    }

    /// Execute a command in the project directory
    pub async fn execute_command(
        &self,
        session_id: &str,
        user_id: &str,
        project_id: &str,
        command: &str,
        rpc_url: Option<&str>,
        output_tx: mpsc::Sender<TerminalMessage>,
    ) -> Result<i32> {
        // Validate command
        self.validate_command(command)?;

        // Get working directory
        let working_dir = self.get_or_create_session(session_id, user_id, project_id).await?;

        // Use provided RPC URL or fallback to default
        let effective_rpc_url = rpc_url.unwrap_or(DEFAULT_TESTNET_RPC_URL);

        log::info!("Executing command '{}' in {:?} with RPC URL: {}", command, working_dir, effective_rpc_url);

        // Parse command
        let parts: Vec<&str> = command.split_whitespace().collect();
        let (cmd, args) = parts.split_first().ok_or_else(|| anyhow!("Empty command"))?;

        // Create process with RPC environment variable for NEAR CLI
        let mut child = Command::new(cmd)
            .args(args)
            .current_dir(&working_dir)
            .env("NEAR_RPC_URL", effective_rpc_url)
            .env("NEAR_CLI_TESTNET_RPC_SERVER_URL", effective_rpc_url)
            .env("NEAR_SANDBOX_BIN_PATH", "/usr/bin/false") // Skip sandbox download on ARM Linux
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| anyhow!("Failed to execute command: {}", e))?;

        // Stream stdout
        let stdout = child.stdout.take().expect("stdout");
        let stdout_tx = output_tx.clone();
        let stdout_handle = tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = stdout_tx.send(TerminalMessage::Output {
                    data: format!("{}\n", line),
                    stream: "stdout".to_string(),
                }).await;
            }
        });

        // Stream stderr
        let stderr = child.stderr.take().expect("stderr");
        let stderr_tx = output_tx.clone();
        let stderr_handle = tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let _ = stderr_tx.send(TerminalMessage::Output {
                    data: format!("{}\n", line),
                    stream: "stderr".to_string(),
                }).await;
            }
        });

        // Wait for process to complete with timeout
        let exit_code = match timeout(COMMAND_TIMEOUT, child.wait()).await {
            Ok(Ok(status)) => status.code().unwrap_or(-1),
            Ok(Err(e)) => {
                let _ = output_tx.send(TerminalMessage::Error {
                    message: format!("Process error: {}", e),
                }).await;
                -1
            }
            Err(_) => {
                // Timeout - kill the process
                let _ = child.kill().await;
                let _ = output_tx.send(TerminalMessage::Error {
                    message: "Command timed out after 5 minutes".to_string(),
                }).await;
                -1
            }
        };

        // Wait for output streams to finish
        let _ = stdout_handle.await;
        let _ = stderr_handle.await;

        // Send exit message
        let _ = output_tx.send(TerminalMessage::Exit { code: exit_code }).await;

        Ok(exit_code)
    }

    /// Clean up old sessions (older than 1 hour)
    pub async fn cleanup_old_sessions(&self) {
        let mut sessions = self.sessions.write().await;
        let now = Utc::now();
        let one_hour_ago = now - chrono::Duration::hours(1);

        sessions.retain(|_, session| session.last_activity > one_hour_ago);
    }
}
