use serde_json::json;

async fn prepare_test_environment() -> Result<(near_workspaces::Account, near_workspaces::Contract), Box<dyn std::error::Error>> {
    let worker = near_workspaces::sandbox().await?;
    let contract_wasm = near_workspaces::compile_project("./").await?;
    let contract = worker.dev_deploy(&contract_wasm).await?;
 
    // create accounts
    let account = worker.dev_create_account().await?;
    
    Ok((account, contract))
}

#[tokio::test]
async fn test_can_be_incremented() -> Result<(), Box<dyn std::error::Error>> {
    let (account, contract) = prepare_test_environment().await?;

    let counter_in_zero = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_zero.json::<u8>()?, 0);

    let _ = account
        .call(contract.id(), "increment")
        .args_json(json!({}))
        .transact()
        .await?;

    let _ = account
        .call(contract.id(), "decrement")
        .args_json(json!({}))
        .transact()
        .await?;

    let _ = account
        .call(contract.id(), "increment")
        .args_json(json!({}))
        .transact()
        .await?;

    let counter_in_one = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_one.json::<u8>()?, 1);

    Ok(())
}

#[tokio::test]
async fn test_can_be_incremented_with_points() -> Result<(), Box<dyn std::error::Error>> {
    let (account, contract) = prepare_test_environment().await?;

    let counter_in_zero = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_zero.json::<u8>()?, 0);

    let _ = account
        .call(contract.id(), "increment")
        .args_json(json!({"number": 10}))
        .transact()
        .await?;

    let _ = account
        .call(contract.id(), "decrement")
        .args_json(json!({}))
        .transact()
        .await?;

    let _ = account
        .call(contract.id(), "increment")
        .args_json(json!({}))
        .transact()
        .await?;

    let counter_in_one = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_one.json::<u8>()?, 10);

    Ok(())
}

#[tokio::test]
async fn test_can_be_decremented() -> Result<(), Box<dyn std::error::Error>> {

    let (account, contract) = prepare_test_environment().await?;
    let counter_in_zero = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_zero.json::<u8>()?,0);

    let _ = account
        .call(contract.id(), "decrement")
        .args_json(json!({}))
        .transact()
        .await?;

    let _ = account
        .call(contract.id(), "decrement")
        .args_json(json!({"number":10}))
        .transact()
        .await?;


    let counter_in_minus_one = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_minus_one.json::<i8>()?,-11);
    
    Ok(())
}

#[tokio::test]
async fn test_can_be_decremented_with_points() -> Result<(), Box<dyn std::error::Error>> {

    let (account, contract) = prepare_test_environment().await?;
    let counter_in_zero = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_zero.json::<u8>()?,0);

    let _ = account
        .call(contract.id(), "decrement")
        .args_json(json!({}))
        .transact()
        .await?;

    let _ = account
        .call(contract.id(), "decrement")
        .args_json(json!({}))
        .transact()
        .await?;


    let counter_in_minus_one = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_minus_one.json::<i8>()?,-2);
    
    Ok(())
}

#[tokio::test]
async fn test_can_be_reset() -> Result<(), Box<dyn std::error::Error>> {

    let (account, contract) = prepare_test_environment().await?;
    let counter_in_zero = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_in_zero.json::<u8>()?,0);

    let outcome_increment = account
        .call(contract.id(), "increment")
        .args_json(json!({}))
        .transact()
        .await?;

    assert!(outcome_increment.is_success());

    let outcome_reset = account
        .call(contract.id(), "reset")
        .args_json(json!({}))
        .transact()
        .await?;

    assert!(outcome_reset.is_success());

    let counter_reset = contract
        .view("get_num")
        .args_json(json!({}))
        .await?;

    assert_eq!(counter_reset.json::<i8>()?,0);

    Ok(())
}
