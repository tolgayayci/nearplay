import { supabase } from './supabase';
import { User } from '@/lib/types';

const COUNTER_CODE = `use near_sdk::{log, near};

#[near(contract_state)]
pub struct Counter {
    val: i8,
}

impl Default for Counter {
    fn default() -> Self {
        Self {
            val: 0,
        }
    }
}

#[near]
impl Counter {
    /// Returns the current counter value.
    pub fn get_num(&self) -> i8 {
        self.val
    }

    /// Increments the counter value by 1.
    pub fn increment(&mut self) {
        self.val += 1;
        let log_message = format!("Increased number to {}", self.val);
        log!("{}", log_message);
    }

    /// Decrements the counter value by 1.
    pub fn decrement(&mut self) {
        self.val -= 1;
        let log_message = format!("Decreased number to {}", self.val);
        log!("{}", log_message);
    }

    /// Resets the counter value to 0.
    pub fn reset(&mut self) {
        self.val = 0;
        log!("Reset counter to zero");
    }
}`;

const HELLO_WORLD_CODE = `use near_sdk::{log, near};

#[near(contract_state)]
pub struct HelloWorld {}

impl Default for HelloWorld {
    fn default() -> Self {
        Self {}
    }
}

#[near]
impl HelloWorld {
    pub fn hello(&self) -> String {
        log!("Hello function called");
        "Hello, NEAR World!".to_string()
    }

    pub fn greet(&self, name: String) -> String {
        let greeting = format!("Hello, {}! Welcome to NEAR Playground!", name);
        log!("{}", greeting);
        greeting
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