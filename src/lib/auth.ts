import { supabase } from './supabase';
import { User } from '@/lib/types';

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

export async function createInitialProjects(userId: string) {
  try {
    console.log('Creating initial projects for user:', userId);
    
    // Check if user already has projects to avoid duplicates
    const { data: existingProjects, error: checkError } = await supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .limit(1);
    
    if (checkError) {
      console.error('Error checking existing projects:', checkError);
      // Continue anyway - better to try creating than fail completely
    }
    
    if (existingProjects && existingProjects.length > 0) {
      console.log('User already has projects, skipping initial project creation');
      return;
    }

    // Create both projects in a single batch operation
    const { error } = await supabase
      .from('projects')
      .insert([
        {
          user_id: userId,
          name: 'Hello World',
          description: 'A simple Hello World smart contract to get started with NEAR',
          code: HELLO_WORLD_CODE,
        },
        {
          user_id: userId,
          name: 'Counter',
          description: 'A basic counter smart contract demonstrating NEAR state management',
          code: COUNTER_CODE,
        }
      ]);

    if (error) throw error;
    
    console.log('Initial projects created successfully for user:', userId);
  } catch (error) {
    console.error('Error creating initial projects:', error);
    throw error;
  }
}


export async function signInWithMagicLink(email: string) {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/projects`,
      },
    });

    if (error) throw error;

    return { 
      data, 
      error: null, 
      status: 'magic_link_sent' 
    };
  } catch (error) {
    console.error('Magic link error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Failed to send magic link'),
      status: 'error'
    };
  }
}

export async function signInWithGitHub() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/projects`,
      },
    });

    if (error) throw error;

    return { 
      data, 
      error: null, 
      status: 'oauth_redirect' 
    };
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Failed to sign in with GitHub'),
      status: 'error'
    };
  }
}


export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    
    // Get user data from users table
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
      
    if (error) throw error;
    
    // If user record doesn't exist in users table, create it
    if (!data) {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
        })
        .select()
        .single();
        
      if (insertError) throw insertError;
      return newUser;
    }
    
    return data;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}