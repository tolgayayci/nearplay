use anyhow::{Context, Result};
use log::{info, warn, error};
use std::env;
use near_jsonrpc_client::{methods, JsonRpcClient};
use near_jsonrpc_primitives::types::query::QueryResponseKind;
use near_primitives::types::AccountId;
use near_primitives::transaction::{Action, TransferAction};
use near_crypto::{SecretKey, InMemorySigner, Signer};
use std::str::FromStr;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};

const DEFAULT_TESTNET_RPC_URL: &str = "https://rpc.testnet.near.org";
const RATE_LIMIT_HOURS: i64 = 24;

#[derive(Debug, Serialize, Deserialize)]
pub struct FaucetTransferResult {
    pub success: bool,
    pub transaction_hash: Option<String>,
    pub explorer_url: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitInfo {
    pub can_request: bool,
    pub last_request_at: Option<String>,
    pub next_available_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SupabaseFaucetRequest {
    created_at: String,
    status: String,
}

#[derive(Debug, Deserialize)]
struct TurnstileResponse {
    success: bool,
    #[serde(rename = "error-codes")]
    error_codes: Option<Vec<String>>,
}

/// Verifies a Cloudflare Turnstile token
pub async fn verify_turnstile_token(token: &str) -> Result<bool> {
    let secret_key = env::var("TURNSTILE_SECRET_KEY").unwrap_or_default();

    // If secret key is empty, skip verification (development mode)
    if secret_key.is_empty() {
        warn!("TURNSTILE_SECRET_KEY is empty, skipping verification (dev mode)");
        return Ok(true);
    }

    let client = reqwest::Client::new();

    // Try with real secret key first
    let response = client
        .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
        .form(&[
            ("secret", secret_key.as_str()),
            ("response", token),
        ])
        .send()
        .await
        .context("Failed to send Turnstile verification request")?;

    let turnstile_response: TurnstileResponse = response
        .json()
        .await
        .context("Failed to parse Turnstile response")?;

    if turnstile_response.success {
        return Ok(true);
    }

    // If verification failed, try with test secret key (for development with test site keys)
    // Cloudflare test secret key: 1x0000000000000000000000000000000AA
    info!("Primary verification failed, trying test secret key for development");
    let test_response = client
        .post("https://challenges.cloudflare.com/turnstile/v0/siteverify")
        .form(&[
            ("secret", "1x0000000000000000000000000000000AA"),
            ("response", token),
        ])
        .send()
        .await
        .context("Failed to send test Turnstile verification request")?;

    let test_turnstile_response: TurnstileResponse = test_response
        .json()
        .await
        .context("Failed to parse test Turnstile response")?;

    if !test_turnstile_response.success {
        if let Some(errors) = turnstile_response.error_codes {
            warn!("Turnstile verification failed: {:?}", errors);
        }
    }

    Ok(test_turnstile_response.success)
}

/// Checks if a NEAR account exists on testnet
pub async fn check_account_exists(account_id: &str) -> Result<bool> {
    let rpc_url = env::var("NEAR_RPC_URL").unwrap_or_else(|_| DEFAULT_TESTNET_RPC_URL.to_string());
    let client = JsonRpcClient::connect(&rpc_url);

    let account_id_parsed: AccountId = account_id.parse()
        .context("Invalid account ID format")?;

    let request = methods::query::RpcQueryRequest {
        block_reference: near_primitives::types::BlockReference::latest(),
        request: near_primitives::views::QueryRequest::ViewAccount {
            account_id: account_id_parsed,
        },
    };

    match client.call(request).await {
        Ok(_) => Ok(true),
        Err(e) => {
            // Check if it's a "does not exist" error vs network error
            let err_str = format!("{:?}", e);
            if err_str.contains("doesn't exist") || err_str.contains("does not exist") {
                Ok(false)
            } else {
                Err(anyhow::anyhow!("Failed to check account: {}", e))
            }
        }
    }
}

/// Transfers NEAR tokens from the faucet account to a recipient
pub async fn transfer_near(recipient_account: &str, amount_near: f64) -> Result<FaucetTransferResult> {
    info!("Faucet transfer: {} NEAR to {}", amount_near, recipient_account);

    // Load faucet account credentials from environment
    let faucet_account_id = env::var("FAUCET_ACCOUNT_ID")
        .context("FAUCET_ACCOUNT_ID not found in environment")?;
    let faucet_private_key = env::var("FAUCET_PRIVATE_KEY")
        .context("FAUCET_PRIVATE_KEY not found in environment")?;
    let rpc_url = env::var("NEAR_RPC_URL").unwrap_or_else(|_| DEFAULT_TESTNET_RPC_URL.to_string());

    // Parse account IDs
    let faucet_account: AccountId = faucet_account_id.parse()
        .context("Failed to parse faucet account ID")?;
    let recipient_account_id: AccountId = recipient_account.parse()
        .context("Failed to parse recipient account ID")?;

    // Parse the private key
    let secret_key = SecretKey::from_str(&faucet_private_key)
        .context("Failed to parse faucet private key")?;
    let public_key = secret_key.public_key();

    // Create JSON-RPC client
    let client = JsonRpcClient::connect(&rpc_url);

    // Get access key for the faucet account
    let access_key_query = methods::query::RpcQueryRequest {
        block_reference: near_primitives::types::BlockReference::latest(),
        request: near_primitives::views::QueryRequest::ViewAccessKey {
            account_id: faucet_account.clone(),
            public_key: public_key.clone(),
        },
    };

    let access_key_response = client.call(access_key_query).await
        .context("Failed to get faucet access key")?;

    let nonce = match access_key_response.kind {
        QueryResponseKind::AccessKey(key) => key.nonce,
        _ => return Err(anyhow::anyhow!("Unexpected query response")),
    };

    // Get latest block
    let block = client.call(methods::block::RpcBlockRequest {
        block_reference: near_primitives::types::BlockReference::latest(),
    }).await?;

    let block_hash = block.header.hash;

    // Convert NEAR to yoctoNEAR (1 NEAR = 10^24 yoctoNEAR)
    let amount_yocto: u128 = (amount_near * 1_000_000_000_000_000_000_000_000.0) as u128;

    // Create transfer action
    let actions = vec![
        Action::Transfer(TransferAction {
            deposit: amount_yocto,
        }),
    ];

    let transaction = near_primitives::transaction::Transaction {
        signer_id: faucet_account.clone(),
        public_key: public_key.clone(),
        nonce: nonce + 1,
        receiver_id: recipient_account_id.clone(),
        block_hash,
        actions,
    };

    // Sign and send transaction
    let signer = InMemorySigner::from_secret_key(faucet_account.clone(), secret_key.clone());
    let signature = signer.sign(transaction.get_hash_and_size().0.as_ref());
    let signed_transaction = near_primitives::transaction::SignedTransaction::new(
        signature,
        transaction,
    );

    let request = methods::broadcast_tx_commit::RpcBroadcastTxCommitRequest {
        signed_transaction,
    };

    info!("Broadcasting faucet transfer transaction...");
    match client.call(request).await {
        Ok(tx_result) => {
            let tx_hash = tx_result.transaction.hash.to_string();
            let explorer_url = format!("https://testnet.nearblocks.io/txns/{}", tx_hash);
            info!("Faucet transfer successful: {}", tx_hash);

            Ok(FaucetTransferResult {
                success: true,
                transaction_hash: Some(tx_hash),
                explorer_url: Some(explorer_url),
                error: None,
            })
        }
        Err(e) => {
            error!("Faucet transfer failed: {:?}", e);
            Ok(FaucetTransferResult {
                success: false,
                transaction_hash: None,
                explorer_url: None,
                error: Some(format!("Transaction failed: {}", e)),
            })
        }
    }
}

/// Gets the faucet account balance in NEAR
pub async fn get_faucet_balance() -> Result<f64> {
    let faucet_account_id = env::var("FAUCET_ACCOUNT_ID")
        .context("FAUCET_ACCOUNT_ID not found in environment")?;
    let rpc_url = env::var("NEAR_RPC_URL").unwrap_or_else(|_| DEFAULT_TESTNET_RPC_URL.to_string());

    let client = JsonRpcClient::connect(&rpc_url);

    let account_id: AccountId = faucet_account_id.parse()
        .context("Failed to parse faucet account ID")?;

    let request = methods::query::RpcQueryRequest {
        block_reference: near_primitives::types::BlockReference::latest(),
        request: near_primitives::views::QueryRequest::ViewAccount {
            account_id,
        },
    };

    let response = client.call(request).await
        .context("Failed to get faucet account info")?;

    match response.kind {
        QueryResponseKind::ViewAccount(account) => {
            // Convert yoctoNEAR to NEAR
            let balance_near = account.amount as f64 / 1_000_000_000_000_000_000_000_000.0;
            Ok(balance_near)
        }
        _ => Err(anyhow::anyhow!("Unexpected query response")),
    }
}

/// Checks if a user is rate limited for faucet requests (24 hour limit)
/// Returns RateLimitInfo with can_request=true if allowed, or false with next_available_at if limited
pub async fn check_rate_limit(user_id: &str) -> Result<RateLimitInfo> {
    let supabase_url = env::var("SUPABASE_URL")
        .context("SUPABASE_URL not found in environment")?;
    let supabase_key = env::var("SUPABASE_SERVICE_ROLE_KEY")
        .context("SUPABASE_SERVICE_ROLE_KEY not found in environment")?;

    let client = reqwest::Client::new();

    // Query the last successful faucet request for this user
    let url = format!(
        "{}/rest/v1/faucet_requests?user_id=eq.{}&status=eq.success&order=created_at.desc&limit=1",
        supabase_url, user_id
    );

    let response = client
        .get(&url)
        .header("apikey", &supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
        .context("Failed to query faucet requests")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase query failed: {} - {}", status, body);
        return Err(anyhow::anyhow!("Failed to check rate limit: {}", status));
    }

    let requests: Vec<SupabaseFaucetRequest> = response
        .json()
        .await
        .context("Failed to parse faucet requests response")?;

    if requests.is_empty() {
        // No previous requests, allow
        return Ok(RateLimitInfo {
            can_request: true,
            last_request_at: None,
            next_available_at: None,
        });
    }

    // Parse the last request timestamp
    let last_request = &requests[0];
    let last_request_time = DateTime::parse_from_rfc3339(&last_request.created_at)
        .context("Failed to parse last request timestamp")?
        .with_timezone(&Utc);

    let next_available = last_request_time + Duration::hours(RATE_LIMIT_HOURS);
    let now = Utc::now();

    if now >= next_available {
        // Rate limit expired, allow
        Ok(RateLimitInfo {
            can_request: true,
            last_request_at: Some(last_request.created_at.clone()),
            next_available_at: None,
        })
    } else {
        // Still rate limited
        info!(
            "User {} is rate limited. Last request: {}, Next available: {}",
            user_id, last_request.created_at, next_available.to_rfc3339()
        );
        Ok(RateLimitInfo {
            can_request: false,
            last_request_at: Some(last_request.created_at.clone()),
            next_available_at: Some(next_available.to_rfc3339()),
        })
    }
}

/// Gets the last N faucet requests for a user
pub async fn get_faucet_history(user_id: &str, limit: usize) -> Result<Vec<crate::models::FaucetHistoryItem>> {
    let supabase_url = env::var("SUPABASE_URL")
        .context("SUPABASE_URL not found in environment")?;
    let supabase_key = env::var("SUPABASE_SERVICE_ROLE_KEY")
        .context("SUPABASE_SERVICE_ROLE_KEY not found in environment")?;

    let client = reqwest::Client::new();

    let url = format!(
        "{}/rest/v1/faucet_requests?user_id=eq.{}&order=created_at.desc&limit={}",
        supabase_url, user_id, limit
    );

    let response = client
        .get(&url)
        .header("apikey", &supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
        .context("Failed to query faucet history")?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        error!("Supabase query failed: {} - {}", status, body);
        return Err(anyhow::anyhow!("Failed to get faucet history: {}", status));
    }

    #[derive(Deserialize)]
    struct SupabaseHistoryItem {
        id: String,
        recipient_account: String,
        amount: f64,
        status: String,
        transaction_hash: Option<String>,
        error_message: Option<String>,
        created_at: String,
    }

    let items: Vec<SupabaseHistoryItem> = response
        .json()
        .await
        .context("Failed to parse faucet history response")?;

    Ok(items.into_iter().map(|item| {
        let explorer_url = item.transaction_hash.as_ref().map(|tx| format!("https://testnet.nearblocks.io/txns/{}", tx));
        crate::models::FaucetHistoryItem {
            id: item.id,
            recipient_account: item.recipient_account,
            amount: item.amount,
            status: item.status,
            transaction_hash: item.transaction_hash,
            explorer_url,
            error_message: item.error_message,
            created_at: item.created_at,
        }
    }).collect())
}
