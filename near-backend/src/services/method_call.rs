use anyhow::{Context, Result};
use log::info;
use serde_json::{json, Value};
use std::env;
use crate::models::MethodCallResponse;
use near_jsonrpc_client::{methods, JsonRpcClient};
use near_jsonrpc_primitives::types::query::QueryResponseKind;
use near_primitives::types::{AccountId, BlockReference};
use near_primitives::transaction::{Action, FunctionCallAction};
use near_primitives::views::QueryRequest;
use near_crypto::{SecretKey, InMemorySigner, Signer};
use std::str::FromStr;
use base64::{Engine as _, engine::general_purpose};

const TESTNET_RPC_URL: &str = "https://rpc.testnet.near.org";

pub async fn call_contract_method(
    contract_address: &str,
    method_name: &str,
    args: &Value,
    method_type: &str,
) -> Result<MethodCallResponse> {
    info!(
        "Calling {} method '{}' on contract: {}",
        method_type, method_name, contract_address
    );

    // Create JSON-RPC client
    let client = JsonRpcClient::connect(TESTNET_RPC_URL);

    if method_type == "view" {
        // Execute view method (read-only, no transaction needed)
        call_view_method(&client, contract_address, method_name, args).await
    } else {
        // Execute change method (requires transaction)
        // For change methods, we need to use the subaccount's keys
        // Since all subaccounts use the same keys as the parent, we can use those

        // Load NEAR credentials from environment
        let near_private_key = env::var("NEAR_PRIVATE_KEY")
            .context("NEAR_PRIVATE_KEY not found in environment")?;

        call_change_method(&client, contract_address, method_name, args, &near_private_key).await
    }
}

async fn call_view_method(
    client: &JsonRpcClient,
    contract_address: &str,
    method_name: &str,
    args: &Value,
) -> Result<MethodCallResponse> {
    info!("Executing view method: {} on {}", method_name, contract_address);

    // Parse contract ID
    let contract_id: AccountId = contract_address.parse()
        .context("Failed to parse contract address")?;

    // Prepare arguments as base64
    let args_bytes = args.to_string().into_bytes();

    // Create view request
    let request = methods::query::RpcQueryRequest {
        block_reference: BlockReference::latest(),
        request: QueryRequest::CallFunction {
            account_id: contract_id,
            method_name: method_name.to_string(),
            args: args_bytes.into(),
        },
    };

    // Execute the view call
    match client.call(request).await {
        Ok(response) => {
            match response.kind {
                QueryResponseKind::CallResult(result) => {
                    // Parse the result
                    let result_str = String::from_utf8(result.result.clone())?;
                    let parsed_result: Value = serde_json::from_str(&result_str)
                        .unwrap_or_else(|_| json!(result_str));

                    // Return both parsed and raw result for full transparency
                    Ok(MethodCallResponse {
                        success: true,
                        result: Some(json!({
                            "result": parsed_result,
                            "logs": result.logs.clone(),
                            "raw": general_purpose::STANDARD.encode(&result.result)
                        })),
                        transaction_hash: None,
                        logs: result.logs,
                        gas_used: None, // View methods don't consume gas
                        error: None,
                    })
                }
                _ => Ok(MethodCallResponse {
                    success: false,
                    result: None,
                    transaction_hash: None,
                    logs: vec![],
                    gas_used: None,
                    error: Some("Unexpected response type".to_string()),
                }),
            }
        }
        Err(e) => {
            Ok(MethodCallResponse {
                success: false,
                result: None,
                transaction_hash: None,
                logs: vec![],
                gas_used: None,
                error: Some(format!("View method failed: {}", e)),
            })
        }
    }
}

async fn call_change_method(
    client: &JsonRpcClient,
    contract_address: &str,
    method_name: &str,
    args: &Value,
    private_key: &str,
) -> Result<MethodCallResponse> {
    info!("Executing change method: {} on {}", method_name, contract_address);

    // Parse contract ID (which is also the signer for subaccounts)
    let contract_id: AccountId = contract_address.parse()
        .context("Failed to parse contract address")?;

    // Parse the private key
    let secret_key = SecretKey::from_str(private_key)
        .context("Failed to parse private key")?;
    let public_key = secret_key.public_key();

    // Create signer for the contract account (subaccount)
    let signer = InMemorySigner::from_secret_key(contract_id.clone(), secret_key);

    // Get access key for the account
    let access_key_query = methods::query::RpcQueryRequest {
        block_reference: BlockReference::latest(),
        request: QueryRequest::ViewAccessKey {
            account_id: contract_id.clone(),
            public_key: public_key.clone(),
        },
    };

    let access_key_response = client.call(access_key_query).await
        .context("Failed to get access key")?;

    let nonce = match access_key_response.kind {
        QueryResponseKind::AccessKey(key) => key.nonce,
        _ => return Err(anyhow::anyhow!("Unexpected query response")),
    };

    // Get latest block
    let block = client.call(methods::block::RpcBlockRequest {
        block_reference: BlockReference::latest(),
    }).await?;

    let block_hash = block.header.hash;

    // Prepare function call arguments
    let args_bytes = args.to_string().into_bytes();

    // Create function call action
    let actions = vec![
        Action::FunctionCall(FunctionCallAction {
            method_name: method_name.to_string(),
            args: args_bytes,
            gas: 30_000_000_000_000, // 30 TGas
            deposit: 0, // No deposit by default (can be changed if needed)
        }),
    ];

    // Create transaction
    let transaction = near_primitives::transaction::Transaction {
        signer_id: contract_id.clone(),
        public_key: public_key.clone(),
        nonce: nonce + 1,
        receiver_id: contract_id.clone(),
        block_hash,
        actions,
    };

    // Sign and send transaction
    let signature = signer.sign(transaction.get_hash_and_size().0.as_ref());
    let signed_transaction = near_primitives::transaction::SignedTransaction::new(
        signature,
        transaction,
    );

    let request = methods::broadcast_tx_commit::RpcBroadcastTxCommitRequest {
        signed_transaction,
    };

    // Send the transaction
    match client.call(request).await {
        Ok(tx_result) => {
            let tx_hash = tx_result.transaction.hash.to_string();
            let gas_used = format!("{:.2} TGas",
                tx_result.transaction_outcome.outcome.gas_burnt as f64 / 1_000_000_000_000.0);

            // Extract logs from receipts
            let mut logs = vec![];
            for receipt_outcome in &tx_result.receipts_outcome {
                logs.extend(receipt_outcome.outcome.logs.clone());
            }

            // Check for execution errors and extract result
            let (success, result, error) = match &tx_result.status {
                near_primitives::views::FinalExecutionStatus::SuccessValue(value) => {
                    let parsed_result = if !value.is_empty() {
                        let result_str = String::from_utf8(value.clone())?;
                        serde_json::from_str(&result_str)
                            .unwrap_or_else(|_| json!(result_str))
                    } else {
                        json!(null)
                    };

                    // Return complete transaction result including status
                    (true, Some(json!({
                        "status": "SuccessValue",
                        "result": parsed_result,
                        "transaction_outcome": {
                            "id": tx_result.transaction_outcome.id.to_string(),
                            "outcome": {
                                "status": "SuccessValue",
                                "logs": tx_result.transaction_outcome.outcome.logs.clone(),
                                "receipt_ids": tx_result.transaction_outcome.outcome.receipt_ids.iter().map(|id| id.to_string()).collect::<Vec<_>>(),
                                "gas_burnt": tx_result.transaction_outcome.outcome.gas_burnt,
                            }
                        },
                        "receipts_outcome": tx_result.receipts_outcome.iter().map(|r| json!({
                            "id": r.id.to_string(),
                            "outcome": {
                                "status": format!("{:?}", r.outcome.status),
                                "logs": r.outcome.logs.clone(),
                                "gas_burnt": r.outcome.gas_burnt,
                            }
                        })).collect::<Vec<_>>(),
                    })), None)
                }
                near_primitives::views::FinalExecutionStatus::Failure(err) => {
                    // Parse the ActionError string to extract structured error info
                    let error_str = format!("{:?}", err);

                    // Try to parse ActionError structure from the debug string
                    let error_json = if error_str.contains("ActionError") {
                        // Extract the error message from the ExecutionError
                        if let Some(exec_error_start) = error_str.find("ExecutionError(\"") {
                            let msg_start = exec_error_start + 16; // Length of "ExecutionError(\""
                            if let Some(msg_end) = error_str[msg_start..].find("\")") {
                                let error_msg = &error_str[msg_start..msg_start + msg_end];

                                // Extract index if present
                                let index = if error_str.contains("index: Some(0)") {
                                    Some(0)
                                } else if error_str.contains("index: Some(1)") {
                                    Some(1)
                                } else {
                                    None
                                };

                                let mut action_error = serde_json::Map::new();
                                if let Some(idx) = index {
                                    action_error.insert("index".to_string(), json!(idx));
                                }
                                action_error.insert("kind".to_string(), json!({
                                    "FunctionCallError": {
                                        "ExecutionError": error_msg
                                    }
                                }));

                                json!({ "ActionError": action_error })
                            } else {
                                json!({ "error": error_str })
                            }
                        } else {
                            json!({ "error": error_str })
                        }
                    } else {
                        json!({ "error": error_str })
                    };

                    // Return structured error response
                    (false, Some(json!({
                        "status": "Failure",
                        "error": error_json,
                        "transaction_outcome": {
                            "id": tx_result.transaction_outcome.id.to_string(),
                            "outcome": {
                                "status": "Failure",
                                "logs": tx_result.transaction_outcome.outcome.logs.clone(),
                                "gas_burnt": tx_result.transaction_outcome.outcome.gas_burnt,
                            }
                        },
                        "receipts_outcome": tx_result.receipts_outcome.iter().map(|r| json!({
                            "id": r.id.to_string(),
                            "outcome": {
                                "status": format!("{:?}", r.outcome.status),
                                "logs": r.outcome.logs.clone(),
                                "gas_burnt": r.outcome.gas_burnt,
                            }
                        })).collect::<Vec<_>>(),
                    })), None)
                }
                near_primitives::views::FinalExecutionStatus::NotStarted |
                near_primitives::views::FinalExecutionStatus::Started => {
                    // Transaction is still processing
                    (true, Some(json!({
                        "status": format!("{:?}", tx_result.status),
                        "transaction_outcome": {
                            "id": tx_result.transaction_outcome.id.to_string(),
                            "outcome": {
                                "status": "Pending",
                                "logs": tx_result.transaction_outcome.outcome.logs.clone(),
                                "gas_burnt": tx_result.transaction_outcome.outcome.gas_burnt,
                            }
                        }
                    })), None)
                }
            };

            Ok(MethodCallResponse {
                success,
                result,
                transaction_hash: Some(tx_hash.clone()),
                logs,
                gas_used: Some(gas_used),
                error,
            })
        }
        Err(e) => {
            Ok(MethodCallResponse {
                success: false,
                result: None,
                transaction_hash: None,
                logs: vec![],
                gas_used: None,
                error: Some(format!("Transaction failed: {}", e)),
            })
        }
    }
}