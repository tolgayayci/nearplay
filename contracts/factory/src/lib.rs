use near_sdk::borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::UnorderedMap;
use near_sdk::{env, near, require, AccountId, Gas, NearToken, Promise};

/// Minimum deposit required for contract deployment (2.5 NEAR covers most cases)
const MIN_DEPOSIT: NearToken = NearToken::from_near(2);

/// Information about a deployed contract
#[derive(BorshDeserialize, BorshSerialize)]
#[borsh(crate = "near_sdk::borsh")]
pub struct ContractInfo {
    /// Account that requested the deployment
    pub deployer: AccountId,
    /// Timestamp when deployed
    pub deployed_at: u64,
    /// Size of the deployed code in bytes
    pub code_size: u64,
}

#[near(contract_state)]
pub struct Factory {
    /// Owner of the factory (can update settings)
    owner: AccountId,
    /// Map of deployed contract account IDs to their info
    deployed_contracts: UnorderedMap<AccountId, ContractInfo>,
    /// Total number of deployments
    deployment_count: u64,
}

impl Default for Factory {
    fn default() -> Self {
        Self {
            owner: env::predecessor_account_id(),
            deployed_contracts: UnorderedMap::new(b"d"),
            deployment_count: 0,
        }
    }
}

#[near]
impl Factory {
    /// Initialize the factory with an owner
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self {
            owner,
            deployed_contracts: UnorderedMap::new(b"d"),
            deployment_count: 0,
        }
    }

    /// Deploy a contract to a new sub-account
    ///
    /// The contract will be deployed to: `{name}.{factory_account_id}`
    /// The signer's public key will be added as a full access key
    ///
    /// # Arguments
    /// * `name` - The name for the sub-account (will be prefixed to factory account)
    /// * `code` - The WASM bytecode to deploy (as Vec<u8>)
    ///
    /// # Returns
    /// Promise that resolves when deployment is complete
    #[payable]
    pub fn deploy_contract(&mut self, name: String, code: Vec<u8>) -> Promise {
        let deposit = env::attached_deposit();
        require!(
            deposit >= MIN_DEPOSIT,
            format!("Minimum deposit is {} NEAR", MIN_DEPOSIT.as_near())
        );

        require!(!name.is_empty(), "Contract name cannot be empty");
        require!(name.len() <= 64, "Contract name too long (max 64 chars)");
        require!(
            name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_'),
            "Contract name can only contain lowercase letters, numbers, hyphens, and underscores"
        );
        require!(!code.is_empty(), "Contract code cannot be empty");

        // Build sub-account ID
        let factory_id = env::current_account_id();
        let sub_account_id: AccountId = format!("{}.{}", name, factory_id)
            .parse()
            .expect("Invalid account ID");

        // Ensure not already deployed
        require!(
            !self.deployed_contracts.get(&sub_account_id).is_some(),
            "A contract with this name already exists"
        );

        // Get the signer's public key to add as full access key
        let signer_pk = env::signer_account_pk();

        // Store deployment info
        self.deployed_contracts.insert(
            &sub_account_id,
            &ContractInfo {
                deployer: env::predecessor_account_id(),
                deployed_at: env::block_timestamp(),
                code_size: code.len() as u64,
            },
        );
        self.deployment_count += 1;

        // Create account, deploy code, and add full access key
        Promise::new(sub_account_id)
            .create_account()
            .transfer(deposit)
            .deploy_contract(code)
            .add_full_access_key(signer_pk)
    }

    /// Deploy contract with initialization call
    ///
    /// Same as deploy_contract but also calls an init method after deployment
    #[payable]
    pub fn deploy_and_init(
        &mut self,
        name: String,
        code: Vec<u8>,
        init_method: String,
        init_args: Vec<u8>,
    ) -> Promise {
        let deposit = env::attached_deposit();
        require!(
            deposit >= MIN_DEPOSIT,
            format!("Minimum deposit is {} NEAR", MIN_DEPOSIT.as_near())
        );

        require!(!name.is_empty(), "Contract name cannot be empty");
        require!(name.len() <= 64, "Contract name too long (max 64 chars)");
        require!(
            name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_'),
            "Contract name can only contain lowercase letters, numbers, hyphens, and underscores"
        );
        require!(!code.is_empty(), "Contract code cannot be empty");
        require!(!init_method.is_empty(), "Init method name cannot be empty");

        // Build sub-account ID
        let factory_id = env::current_account_id();
        let sub_account_id: AccountId = format!("{}.{}", name, factory_id)
            .parse()
            .expect("Invalid account ID");

        require!(
            !self.deployed_contracts.get(&sub_account_id).is_some(),
            "A contract with this name already exists"
        );

        let signer_pk = env::signer_account_pk();

        self.deployed_contracts.insert(
            &sub_account_id,
            &ContractInfo {
                deployer: env::predecessor_account_id(),
                deployed_at: env::block_timestamp(),
                code_size: code.len() as u64,
            },
        );
        self.deployment_count += 1;

        // Reserve some NEAR for the contract to use
        let init_deposit = NearToken::from_yoctonear(deposit.as_yoctonear() / 10);
        let account_deposit = deposit.saturating_sub(init_deposit);

        Promise::new(sub_account_id)
            .create_account()
            .transfer(account_deposit)
            .deploy_contract(code)
            .add_full_access_key(signer_pk)
            .function_call(
                init_method,
                init_args,
                init_deposit,
                Gas::from_tgas(30),
            )
    }

    // ==================== View Methods ====================

    /// Get info about a deployed contract
    pub fn get_contract_info(&self, account_id: AccountId) -> Option<ContractInfoView> {
        self.deployed_contracts.get(&account_id).map(|info| ContractInfoView {
            deployer: info.deployer.to_string(),
            deployed_at: info.deployed_at,
            code_size: info.code_size,
        })
    }

    /// Get total number of deployments
    pub fn get_deployment_count(&self) -> u64 {
        self.deployment_count
    }

    /// Get the factory owner
    pub fn get_owner(&self) -> AccountId {
        self.owner.clone()
    }

    /// Check if a name is available for deployment
    pub fn is_name_available(&self, name: String) -> bool {
        let factory_id = env::current_account_id();
        let sub_account_id: Result<AccountId, _> = format!("{}.{}", name, factory_id).parse();
        match sub_account_id {
            Ok(id) => !self.deployed_contracts.get(&id).is_some(),
            Err(_) => false,
        }
    }

    /// Get recent deployments (last N)
    pub fn get_recent_deployments(&self, limit: u64) -> Vec<DeploymentEntry> {
        let mut entries: Vec<(AccountId, ContractInfo)> = self
            .deployed_contracts
            .iter()
            .collect();

        // Sort by deployed_at descending
        entries.sort_by(|a, b| b.1.deployed_at.cmp(&a.1.deployed_at));

        entries
            .into_iter()
            .take(limit as usize)
            .map(|(account_id, info)| DeploymentEntry {
                contract_id: account_id.to_string(),
                deployer: info.deployer.to_string(),
                deployed_at: info.deployed_at,
                code_size: info.code_size,
            })
            .collect()
    }

    /// Get the minimum deposit required
    pub fn get_min_deposit(&self) -> String {
        MIN_DEPOSIT.as_yoctonear().to_string()
    }

    // ==================== Owner Methods ====================

    /// Update the factory owner (only current owner can call)
    pub fn set_owner(&mut self, new_owner: AccountId) {
        require!(
            env::predecessor_account_id() == self.owner,
            "Only owner can update owner"
        );
        self.owner = new_owner;
    }
}

/// View struct for contract info (for JSON serialization)
#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct ContractInfoView {
    pub deployer: String,
    pub deployed_at: u64,
    pub code_size: u64,
}

/// Entry for deployment list
#[derive(near_sdk::serde::Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct DeploymentEntry {
    pub contract_id: String,
    pub deployer: String,
    pub deployed_at: u64,
    pub code_size: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_name_validation() {
        // Valid names
        assert!("my-contract".chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_'));
        assert!("test_123".chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_'));

        // Invalid names
        assert!(!"My-Contract".chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_'));
        assert!(!"test.contract".chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_'));
    }
}
