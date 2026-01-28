use near_workspaces::{types::NearToken, Account, Contract};
use serde_json::json;

#[tokio::test]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let worker = near_workspaces::sandbox().await?;

    // Build and deploy hello contract
    let hello_contract_wasm = near_workspaces::compile_project("./tests/hello-near").await?;
    let hello_contract: Contract = worker.dev_deploy(&hello_contract_wasm).await?;

    // Deploy contract for testing
    let contract_wasm = near_workspaces::compile_project("./").await?;
    let contract = worker.dev_deploy(&contract_wasm).await?;

    // Create accounts
    let account = worker.dev_create_account().await?;
    let alice = account
        .create_subaccount("alice")
        .initial_balance(NearToken::from_near(30))
        .transact()
        .await?
        .into_result()?;

    // Init contract
    let _ = contract
        .call("init")
        .args_json(json!({ "hello_account": hello_contract.id() }))
        .transact()
        .await?
        .into_result()?;

    // Begin tests
    test_hl_default_greeting(&alice, &contract).await?;
    test_hl_change_greeting(&alice, &contract).await?;
    test_ll_change_greeting(&alice, &contract).await?;
    Ok(())
}

async fn test_hl_default_greeting(
    user: &Account,
    contract: &Contract,
) -> Result<(), Box<dyn std::error::Error>> {
    let greeting: String = user
        .call(contract.id(), "hl_query_greeting")
        .args_json(json!({}))
        .max_gas()
        .transact()
        .await?
        .json()?;

    assert_eq!(greeting, "Hello".to_string());
    Ok(())
}

async fn test_hl_change_greeting(
    user: &Account,
    contract: &Contract,
) -> Result<(), Box<dyn std::error::Error>> {
    let result: bool = user
        .call(contract.id(), "hl_change_greeting")
        .args_json(json!({ "new_greeting": "Howdy" }))
        .max_gas()
        .transact()
        .await?
        .json()?;

    assert!(result);

    let greeting: String = user
        .call(contract.id(), "hl_query_greeting")
        .args_json(json!({}))
        .max_gas()
        .transact()
        .await?
        .json()?;

    assert_eq!(greeting, "Howdy".to_string());
    Ok(())
}

async fn test_ll_change_greeting(
    user: &Account,
    contract: &Contract,
) -> Result<(), Box<dyn std::error::Error>> {
    let result: bool = user
        .call(contract.id(), "ll_change_greeting")
        .args_json(json!({ "new_greeting": "Hello" }))
        .max_gas()
        .transact()
        .await?
        .json()?;

    assert!(result);

    let greeting: String = user
        .call(contract.id(), "ll_query_greeting")
        .args_json(json!({}))
        .max_gas()
        .transact()
        .await?
        .json()?;

    assert_eq!(greeting, "Hello".to_string());
    Ok(())
}
