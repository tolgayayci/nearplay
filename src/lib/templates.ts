import {
  Code2,
  MessageCircle,
  Coins,
  Image,
  Dices,
} from 'lucide-react';
import { FUNGIBLE_TOKEN_CODE } from './fungible-token-template';
import { NFT_CODE } from './nft-template';
import { COIN_FLIP_CODE } from './coin-flip-template';

const HELLO_WORLD_CODE = `// Find all our documentation at https://docs.near.org
use near_sdk::{log, near};

// Define the contract structure
#[near(contract_state)]
pub struct Contract {
    greeting: String,
}

// Define the default, which automatically initializes the contract
impl Default for Contract {
    fn default() -> Self {
        Self {
            greeting: "Hello".to_string(),
        }
    }
}

// Implement the contract structure
#[near]
impl Contract {
    // Public method - returns the greeting saved, defaulting to DEFAULT_GREETING
    pub fn get_greeting(&self) -> String {
        self.greeting.clone()
    }

    // Public method - accepts a greeting, such as "howdy", and records it
    pub fn set_greeting(&mut self, greeting: String) {
        log!("Saving greeting: {}", greeting);
        self.greeting = greeting;
    }
}`;

const COUNTER_CODE = `// Find all our documentation at https://docs.near.org
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
 * to run these, the command will be: \`cargo test\`
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
}`;

export const PROJECT_TEMPLATES = [
  {
    name: "Hello World",
    description: "The Hello World smart contract stores a greeting in its state, and exposes two functions to interact with it.",
    icon: MessageCircle,
    code: HELLO_WORLD_CODE,
    category: "Basic",
    difficulty: "Beginner",
    features: [
      "Simple contract structure",
      "String state storage",
      "Get and set methods",
      "Default initialization",
    ],
  },
  {
    name: "Counter Contract",
    description: "A foundational smart contract demonstrating state management and basic interactions. Perfect starting point for learning NEAR development with a simple yet practical example.",
    icon: Code2,
    code: COUNTER_CODE,
    category: "Basic",
    difficulty: "Beginner",
    features: [
      "Learn basic contract structure",
      "Understand state variables",
      "Implement safe arithmetic",
      "Handle error conditions",
    ],
  },
  {
    name: "Fungible Token",
    description: "Example implementations of money-like tokens, where one token is the same as any other, using the NEP-141 spec (similar to ERC-20)",
    icon: Coins,
    code: FUNGIBLE_TOKEN_CODE,
    category: "Token",
    difficulty: "Intermediate",
    features: [
      "NEP-141 token standard",
      "Storage management",
      "Transfer and transfer_call",
      "Metadata support",
      "Account registration",
    ],
  },
  {
    name: "Non-Fungible Token",
    description: "Example implementations of tokens to represent unique assets, such as collectibles or deeds, using the NEP-171 spec (similar to ERC-721)",
    icon: Image,
    code: NFT_CODE,
    category: "Token",
    difficulty: "Intermediate",
    features: [
      "NEP-171 NFT standard",
      "Minting functionality",
      "Approval management",
      "Enumeration support",
      "Token metadata",
      "Transfer capabilities",
    ],
  },
  {
    name: "Coin Flip",
    description: "A random coin-flip that lives in the NEAR blockchain",
    icon: Dices,
    code: COIN_FLIP_CODE,
    category: "Game",
    difficulty: "Beginner",
    features: [
      "Random number generation",
      "Player points tracking",
      "State management",
      "Game logic",
      "UnorderedMap usage",
    ],
  },
];

export interface Template {
  id?: string;
  name: string;
  description: string;
  icon: any;
  code: string;
  category: string;
  difficulty: string;
  features: string[];
  isCommunity?: boolean;
  githubUrl?: string;
  documentation?: string;
  references?: Array<{
    title: string;
    url: string;
  }>;
}

export const templates: Template[] = PROJECT_TEMPLATES.map((template, index) => ({
  ...template,
  id: template.name.toLowerCase().replace(/\s+/g, '-'),
}));