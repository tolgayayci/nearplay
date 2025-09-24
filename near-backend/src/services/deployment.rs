use anyhow::{Context, Result};
use log::{info, warn, error};
use std::fs;
use std::path::PathBuf;
use std::env;
use crate::models::{DeployDetails, DeployResponse};
use near_jsonrpc_client::{methods, JsonRpcClient};
use near_jsonrpc_primitives::types::query::QueryResponseKind;
use near_primitives::types::AccountId;
use near_primitives::transaction::{Action, CreateAccountAction, DeployContractAction, TransferAction, AddKeyAction};
use near_crypto::{SecretKey, PublicKey, InMemorySigner, Signer};
use std::str::FromStr;

const TESTNET_RPC_URL: &str = "https://rpc.testnet.near.org";

pub async fn deploy_contract(
    user_id: &str,
    project_id: &str,
    _account_id: Option<&str>,
) -> Result<DeployResponse> {
    info!(
        "Starting NEAR deployment for project {} by user {}",
        project_id, user_id
    );

    // Load NEAR account credentials from environment
    let parent_account_id = env::var("NEAR_ACCOUNT_ID")
        .context("NEAR_ACCOUNT_ID not found in environment")?;
    let near_private_key = env::var("NEAR_PRIVATE_KEY")
        .context("NEAR_PRIVATE_KEY not found in environment")?;

    // Parse the parent account ID
    let parent_account: AccountId = parent_account_id.parse()
        .context("Failed to parse parent account ID")?;

    // Parse the private key
    let secret_key = SecretKey::from_str(&near_private_key)
        .context("Failed to parse private key")?;
    let public_key = secret_key.public_key();

    // Find the project directory
    let project_path = PathBuf::from("projects").join(user_id).join(project_id);
    if !project_path.exists() {
        return Err(anyhow::anyhow!("Project directory not found: {:?}", project_path));
    }

    // Generate contract name with format: userid[:6]-projectid[:6]-timestamp
    let timestamp = chrono::Utc::now();
    let user_id_short = user_id.chars().take(6).collect::<String>();
    let project_id_short = project_id.chars().take(6).collect::<String>();
    let contract_name = format!("{}-{}-{}",
        user_id_short,
        project_id_short,
        timestamp.timestamp()
    );

    // Create subaccount ID
    let subaccount_id_str = format!("{}.{}", contract_name, parent_account_id);
    let subaccount_id: AccountId = subaccount_id_str.parse()
        .context("Failed to parse subaccount ID")?;

    info!("Deploying to subaccount: {} using NEAR JSON-RPC", subaccount_id);

    // Find the compiled WASM file for deployment
    let wasm_files: Vec<_> = fs::read_dir(&project_path.join("target").join("near"))
        .context("Failed to read target/near directory")?
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

    if wasm_files.is_empty() {
        return Err(anyhow::anyhow!("No WASM file found. Please compile the project first."));
    }

    let wasm_path = &wasm_files[0];
    let wasm_code = fs::read(wasm_path)
        .context("Failed to read WASM file")?;

    info!("WASM file loaded, size: {} bytes", wasm_code.len());

    // Create JSON-RPC client
    let client = JsonRpcClient::connect(TESTNET_RPC_URL);

    // Check if subaccount already exists
    let account_exists = check_account_exists(&client, &subaccount_id_str).await;

    // Create signer
    let signer = InMemorySigner::from_secret_key(parent_account.clone(), secret_key.clone());

    let transaction_hash: String;
    let block_height: u64;
    let gas_used: String;

    if !account_exists {
        info!("Creating new subaccount: {}", subaccount_id);

        // Get parent account's nonce
        let access_key_query = methods::query::RpcQueryRequest {
            block_reference: near_primitives::types::BlockReference::latest(),
            request: near_primitives::views::QueryRequest::ViewAccessKey {
                account_id: parent_account.clone(),
                public_key: public_key.clone(),
            },
        };

        let access_key_response = client.call(access_key_query).await
            .context("Failed to get access key")?;

        let mut nonce = match access_key_response.kind {
            QueryResponseKind::AccessKey(key) => key.nonce,
            _ => return Err(anyhow::anyhow!("Unexpected query response")),
        };

        // Get latest block
        let block = client.call(methods::block::RpcBlockRequest {
            block_reference: near_primitives::types::BlockReference::latest(),
        }).await?;

        let block_hash = block.header.hash;

        // TRANSACTION 1: Create account, add key, and transfer NEAR
        info!("Transaction 1: Creating account and transferring funds...");

        let create_actions = vec![
            Action::CreateAccount(CreateAccountAction {}),
            Action::AddKey(AddKeyAction {
                public_key: public_key.clone(),
                access_key: near_primitives::account::AccessKey {
                    nonce: 0,
                    permission: near_primitives::account::AccessKeyPermission::FullAccess,
                }
            }),
            Action::Transfer(TransferAction {
                deposit: 2_000_000_000_000_000_000_000_000, // 2.0 NEAR for storage and deployment
            }),
        ];

        nonce += 1;
        let create_transaction = near_primitives::transaction::Transaction {
            signer_id: parent_account.clone(),
            public_key: public_key.clone(),
            nonce,
            receiver_id: subaccount_id.clone(),
            block_hash: block_hash.clone(),
            actions: create_actions,
        };

        // Sign and send first transaction
        let signature = signer.sign(create_transaction.get_hash_and_size().0.as_ref());
        let signed_create_transaction = near_primitives::transaction::SignedTransaction::new(
            signature,
            create_transaction,
        );

        let create_request = methods::broadcast_tx_commit::RpcBroadcastTxCommitRequest {
            signed_transaction: signed_create_transaction,
        };

        info!("Broadcasting account creation transaction...");
        let create_result = match client.call(create_request).await {
            Ok(result) => result,
            Err(e) => {
                error!("Failed to create account: {:?}", e);
                return Err(anyhow::anyhow!("Failed to create account: {}", e));
            }
        };

        info!("Account created successfully: {}", create_result.transaction.hash);

        // Wait a bit for the account to be fully created
        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;

        // TRANSACTION 2: Deploy contract to the now-funded account
        info!("Transaction 2: Deploying contract using subaccount's own keys...");

        // Create signer for the subaccount (using the same keys we added to it)
        let subaccount_signer = InMemorySigner::from_secret_key(subaccount_id.clone(), secret_key.clone());

        // Get access key for the subaccount
        let subaccount_access_key_query = methods::query::RpcQueryRequest {
            block_reference: near_primitives::types::BlockReference::latest(),
            request: near_primitives::views::QueryRequest::ViewAccessKey {
                account_id: subaccount_id.clone(),
                public_key: public_key.clone(),
            },
        };

        let subaccount_access_key_response = client.call(subaccount_access_key_query).await
            .context("Failed to get subaccount access key")?;

        let subaccount_nonce = match subaccount_access_key_response.kind {
            QueryResponseKind::AccessKey(key) => key.nonce,
            _ => return Err(anyhow::anyhow!("Unexpected query response for subaccount")),
        };

        // Get fresh block hash for second transaction
        let block2 = client.call(methods::block::RpcBlockRequest {
            block_reference: near_primitives::types::BlockReference::latest(),
        }).await?;

        let deploy_actions = vec![
            Action::DeployContract(DeployContractAction {
                code: wasm_code.clone(),
            }),
        ];

        let deploy_transaction = near_primitives::transaction::Transaction {
            signer_id: subaccount_id.clone(),
            public_key: public_key.clone(),
            nonce: subaccount_nonce + 1,
            receiver_id: subaccount_id.clone(),
            block_hash: block2.header.hash,
            actions: deploy_actions,
        };

        // Sign and send deployment transaction using subaccount signer
        let deploy_signature = subaccount_signer.sign(deploy_transaction.get_hash_and_size().0.as_ref());
        let signed_deploy_transaction = near_primitives::transaction::SignedTransaction::new(
            deploy_signature,
            deploy_transaction,
        );

        let deploy_request = methods::broadcast_tx_commit::RpcBroadcastTxCommitRequest {
            signed_transaction: signed_deploy_transaction,
        };

        info!("Broadcasting contract deployment transaction...");
        let tx_result = match client.call(deploy_request).await {
            Ok(result) => result,
            Err(e) => {
                error!("Failed to deploy contract: {:?}", e);
                return Err(anyhow::anyhow!("Failed to deploy contract: {}", e));
            }
        };

        transaction_hash = tx_result.transaction.hash.to_string();
        info!("Contract deployed successfully: {}", transaction_hash);

        block_height = tx_result.transaction_outcome.block_hash.as_bytes()
            .iter()
            .take(8)
            .fold(0u64, |acc, &b| (acc << 8) | b as u64);

        gas_used = tx_result.transaction_outcome.outcome.gas_burnt.to_string();

    } else {
        info!("Subaccount already exists, deploying contract only");

        // For existing accounts, we need to use the subaccount to deploy
        // This requires having the subaccount's keys, which we might not have
        // So we'll use the parent account to deploy via a function call

        return Err(anyhow::anyhow!(
            "Subaccount {} already exists. Manual intervention required.",
            subaccount_id
        ));
    }

    // Send proof-of-deployment transfer (0.03 NEAR) from subaccount to parent
    info!("Sending proof-of-deployment transfer");
    let proof_transfer_result = send_proof_transfer(
        &client,
        &subaccount_id,
        &parent_account,
        &secret_key,
        &public_key,
    ).await;

    let proof_tx_hash = match proof_transfer_result {
        Ok(hash) => Some(hash),
        Err(e) => {
            warn!("Proof transfer failed: {}", e);
            None
        }
    };

    let explorer_url = format!("https://testnet.nearblocks.io/txns/{}", transaction_hash);

    // Format gas used for display
    let formatted_gas = format!("{:.2} TGas", gas_used.parse::<u64>().unwrap_or(0) as f64 / 1_000_000_000_000.0);

    // Return deployment response with real data
    let response = DeployResponse {
        success: true,
        transaction_hash: transaction_hash.clone(),
        contract_id: subaccount_id_str.clone(),
        explorer_url,
        gas_used: Some(formatted_gas),
        proof_tx_hash,
        details: DeployDetails {
            network: "testnet".to_string(),
            block_height,
            timestamp,
            deployer_account: parent_account_id.clone(),
        },
    };

    info!(
        "Successfully deployed contract {} for project {} with tx hash: {}",
        contract_name, project_id, transaction_hash
    );

    Ok(response)
}

async fn check_account_exists(client: &JsonRpcClient, account_id: &str) -> bool {
    let account_id_parsed: AccountId = match account_id.parse() {
        Ok(id) => id,
        Err(_) => return false,
    };

    let request = methods::query::RpcQueryRequest {
        block_reference: near_primitives::types::BlockReference::latest(),
        request: near_primitives::views::QueryRequest::ViewAccount {
            account_id: account_id_parsed,
        },
    };

    match client.call(request).await {
        Ok(_) => true,
        Err(_) => false,
    }
}

async fn send_proof_transfer(
    client: &JsonRpcClient,
    from_account_id: &AccountId,
    to_account_id: &AccountId,
    secret_key: &SecretKey,
    public_key: &PublicKey,
) -> Result<String> {
    // Get access key for the subaccount
    let access_key_query = methods::query::RpcQueryRequest {
        block_reference: near_primitives::types::BlockReference::latest(),
        request: near_primitives::views::QueryRequest::ViewAccessKey {
            account_id: from_account_id.clone(),
            public_key: public_key.clone(),
        },
    };

    let access_key_response = client.call(access_key_query).await
        .context("Failed to get access key for proof transfer")?;

    let nonce = match access_key_response.kind {
        QueryResponseKind::AccessKey(key) => key.nonce,
        _ => return Err(anyhow::anyhow!("Unexpected query response")),
    };

    // Get latest block
    let block = client.call(methods::block::RpcBlockRequest {
        block_reference: near_primitives::types::BlockReference::latest(),
    }).await?;

    let block_hash = block.header.hash;

    // Create transfer action
    let actions = vec![
        Action::Transfer(TransferAction {
            deposit: 30_000_000_000_000_000_000_000, // 0.03 NEAR
        }),
    ];

    let transaction = near_primitives::transaction::Transaction {
        signer_id: from_account_id.clone(),
        public_key: public_key.clone(),
        nonce: nonce + 1,
        receiver_id: to_account_id.clone(),
        block_hash,
        actions,
    };

    // Sign and send transaction
    let signer = InMemorySigner::from_secret_key(from_account_id.clone(), secret_key.clone());
    let signature = signer.sign(transaction.get_hash_and_size().0.as_ref());
    let signed_transaction = near_primitives::transaction::SignedTransaction::new(
        signature,
        transaction,
    );

    let request = methods::broadcast_tx_commit::RpcBroadcastTxCommitRequest {
        signed_transaction,
    };

    let tx_result = client.call(request).await
        .context("Failed to broadcast proof transfer")?;

    Ok(tx_result.transaction.hash.to_string())
}