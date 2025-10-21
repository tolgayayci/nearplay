export const CHALLENGE_ONE_CODE = `use near_sdk::{near, env, NearToken, Timestamp};

#[near(contract_state)]
pub struct Contract {
    total_balance: NearToken,     // Total deposited + bonus
    bonus_deadline: Timestamp,    // When bonus period ends
    bonus_amount: NearToken,      // Extra reward for early users
}

impl Default for Contract {
    fn default() -> Self {
        Self {
            total_balance: NearToken::from_near(0),
            // Example: August 5, 2025 00:00:00 UTC
            bonus_deadline: 1_754_582_400_000_000_000,
            bonus_amount: NearToken::from_near(1), // +1 NEAR bonus
        }
    }
}

#[near]
impl Contract {
    // TASK: Implement this function
    // The function should:
    // 1. Get attached deposit amount using env::attached_deposit()
    // 2. Get the current blockchain timestamp using env::block_timestamp()
    // 3. If current time < bonus_deadline, add both the deposit and the bonus to total_balance
    // 4. If current time >= bonus_deadline, add only the deposit
    // 5. (Optional) Log a message like "Bonus applied!" or "Bonus expired!"
    #[payable]
    pub fn timed_bonus_deposit(&mut self) {
        // TODO: Implement logic here
    }
}`;
