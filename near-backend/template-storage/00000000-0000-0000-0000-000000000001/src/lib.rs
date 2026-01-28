// Find all our documentation at https://docs.near.org
use near_sdk::{log, near};

// Define the contract structure
#[near(contract_state)]
#[derive(Default)]
pub struct Counter {
    val: i8,
}

// Implement the contract structure
#[near]
impl Counter {
    // Public read-only method: Returns the counter value.
    pub fn get_num(&self) -> i8 {
        return self.val;
    }

    // Public method: Increment the counter.
    pub fn increment(&mut self, number: Option<i8>) {
        self.val += number.unwrap_or(1);
        log!("Increased number to {}", self.val);
    }

    // Public method: Decrement the counter.
    pub fn decrement(&mut self, number: Option<i8>) {
        self.val -= number.unwrap_or(1);
        log!("Decreased number to {}", self.val);
    }

    // Public method - Reset to zero.
    pub fn reset(&mut self) {
        self.val = 0;
        log!("Reset counter to zero");
    }
}

/*
 * The rest of this file holds the inline tests for the code above
 * to run these, the command will be: `cargo test`
 * Learn more about Rust tests: https://doc.rust-lang.org/book/ch11-01-writing-tests.html
 */
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn increment() {
        // instantiate a contract variable with the counter at zero
        let mut contract = Counter { val: 0 };
        contract.increment(None);
        assert_eq!(1, contract.get_num());
    }

    #[test]
    fn increment_with_points() {
        // instantiate a contract variable with the counter at zero
        let mut contract = Counter { val: 0 };
        contract.increment(Some(10));
        assert_eq!(10, contract.get_num());
    }

    #[test]
    fn decrement() {
        let mut contract = Counter { val: 0 };
        contract.decrement(None);
        assert_eq!(-1, contract.get_num());
    }

    #[test]
    fn decrement_with_points() {
        // instantiate a contract variable with the counter at zero
        let mut contract = Counter { val: 0 };
        contract.decrement(Some(10));
        assert_eq!(-10, contract.get_num());
    }

    #[test]
    fn increment_and_reset() {
        let mut contract = Counter { val: 0 };
        contract.increment(None);
        contract.reset();
        assert_eq!(0, contract.get_num());
    }

    #[test]
    #[should_panic]
    fn panics_on_overflow() {
        let mut contract = Counter { val: 127 };
        contract.increment(None);
    }

    #[test]
    #[should_panic]
    fn panics_on_underflow() {
        let mut contract = Counter { val: -128 };
        contract.decrement(None);
    }
}
