use near_sdk::{env, log, near, serde_json::json, Promise, PromiseError};

use crate::{Contract, ContractExt, NO_ARGS, NO_DEPOSIT, TEN_TGAS};

#[near]
impl Contract {
    // Public - query external greeting
    pub fn ll_query_greeting(&self) -> Promise {
        // Create a promise to call HelloNEAR.get_greeting()
        let hello_promise = Promise::new(self.hello_account.clone()).function_call(
            "get_greeting".to_owned(),
            NO_ARGS,
            NO_DEPOSIT,
            TEN_TGAS,
        );

        hello_promise.then(
            // Create a promise to callback query_greeting_callback
            Self::ext(env::current_account_id())
                .with_static_gas(TEN_TGAS)
                .ll_query_greeting_callback(),
        )
    }

    #[private] // Public - but only callable by env::current_account_id()
    pub fn ll_query_greeting_callback(
        &self,
        #[callback_result] call_result: Result<String, PromiseError>,
    ) -> String {
        // Check if the promise succeeded by calling the method outlined in external.rs
        if call_result.is_err() {
            log!("There was an error contacting Hello NEAR");
            return "".to_string();
        }

        // Return the greeting
        let greeting: String = call_result.unwrap();
        greeting
    }

    // Public - change external greeting
    pub fn ll_change_greeting(&mut self, new_greeting: String) -> Promise {
        let args = json!({ "greeting": new_greeting }).to_string().into_bytes();
        let hello_promise = Promise::new(self.hello_account.clone()).function_call(
            "set_greeting".to_owned(),
            args,
            NO_DEPOSIT,
            TEN_TGAS,
        );

        hello_promise.then(
            // Create a promise to callback query_greeting_callback
            Self::ext(env::current_account_id())
                .with_static_gas(TEN_TGAS)
                .ll_change_greeting_callback(),
        )
    }

    #[private]
    pub fn ll_change_greeting_callback(
        &mut self,
        #[callback_result] call_result: Result<(), PromiseError>,
    ) -> bool {
        // Return whether or not the promise succeeded using the method outlined in external.rs
        if call_result.is_err() {
            env::log_str("set_greeting failed...");
            false
        } else {
            env::log_str("set_greeting was successful!");
            true
        }
    }
}
