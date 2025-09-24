export const COIN_FLIP_CODE = `// Find all our documentation at https://docs.near.org
use near_sdk::collections::UnorderedMap;
use near_sdk::env::{self, log_str};
use near_sdk::{near, AccountId, BorshStorageKey};

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Points,
}

pub(crate) fn simulate_coin_flip() -> String {
    // Here we get a first byte of a random seed
    let random_seed = *env::random_seed().get(0).unwrap() as i8;

    // If a first byte is EVEN we choose heads, otherwise tails
    if let 0 = random_seed % 2 {
        return "heads".to_string();
    } else {
        return "tails".to_string();
    };
}

// Define the contract structure
#[near(contract_state)]
pub struct Contract {
    points: UnorderedMap<AccountId, u8>,
}

// Define the default, which automatically initializes the contract
impl Default for Contract {
    fn default() -> Self {
        Self {
            points: UnorderedMap::new(StorageKey::Points),
        }
    }
}

// Implement the contract structure
#[near]
impl Contract {
    /*
      Flip a coin. Pass in the side (heads or tails) and a random number will be chosen
      indicating whether the flip was heads or tails. If you got it right, you get a point.
    */
    pub fn flip_coin(&mut self, player_guess: String) -> String {
        // Check who called the method
        let player: AccountId = env::predecessor_account_id();
        log_str(&format!("{player} chose {player_guess}"));

        // Simulate a Coin Flip
        let outcome = simulate_coin_flip();

        // Get the current player points
        let mut player_points = self.points.get(&player).unwrap_or(0);

        // Check if their guess was right and modify the points accordingly
        if outcome.eq(&player_guess) {
            player_points = player_points + 1;
        } else {
            player_points = player_points.saturating_sub(1);
        };

        log_str(&format!("player_points: {player_points}"));

        // Store the new points
        self.points.insert(&player, &player_points);

        return outcome;
    }

    // View how many points a specific player has
    pub fn points_of(&self, player: AccountId) -> u8 {
        let points = self.points.get(&player).unwrap_or(0);
        log_str(&format!("Points for {player}: {points}"));

        return points;
    }
}`;