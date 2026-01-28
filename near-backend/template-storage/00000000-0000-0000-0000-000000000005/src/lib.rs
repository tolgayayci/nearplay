// Find all our documentation at https://docs.near.org
use near_sdk::{env, near, AccountId, Gas, NearToken, PanicOnDefault};

pub mod external_contract;
pub use crate::external_contract::*;

pub mod high_level;
pub mod low_level;

const NO_ARGS: Vec<u8> = vec![];
const NO_DEPOSIT: NearToken = NearToken::from_near(0);
const FIVE_TGAS: Gas = Gas::from_tgas(5);
const TEN_TGAS: Gas = Gas::from_tgas(10);

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    pub hello_account: AccountId,
}

#[near]
impl Contract {
    #[init]
    #[private] // Public - but only callable by env::current_account_id()
    pub fn init(hello_account: AccountId) -> Self {
        assert!(!env::state_exists(), "Already initialized");
        Self { hello_account }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HELLO_NEAR: &str = "beneficiary";

    #[test]
    fn initializes() {
        let beneficiary: AccountId = HELLO_NEAR.parse().unwrap();
        let contract = Contract::init(beneficiary);
        assert_eq!(contract.hello_account, HELLO_NEAR)
    }
}
