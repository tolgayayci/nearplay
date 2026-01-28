# Count on NEAR Contract Example

The smart contract exposes methods to interact with a counter stored in the NEAR
network.

## How to Build Locally?

Install [`cargo-near`](https://github.com/near/cargo-near) and run:

```bash
cargo near build
```

## How to Test Locally?

```bash
cargo test
```

## How to Deploy?

Deployment is automated with GitHub Actions CI/CD pipeline. To deploy manually,
install [`cargo-near`](https://github.com/near/cargo-near) and run:

```bash
cargo near deploy <account-id>
```

## How to Interact?

_In this example we will be using [NEAR CLI](https://github.com/near/near-cli)
to intract with the NEAR blockchain and the smart contract_

_If you want full control over of your interactions we recommend using the
[near-cli-rs](https://near.cli.rs)._

### Get the Counter

`get_num` is a read-only method (aka `view` method).

`View` methods can be called for **free** by anyone, even people **without a
NEAR account**!

```bash
# Use near-cli to get the counter value
near view <contract-account-id> get_num
```

### Modify the Counter

`increment`, `decrement` and `reset` change the contract's state, for which they
are `call` methods.

`Call` methods can only be invoked using a NEAR account, since the account needs
to pay GAS for the transaction.

```bash
# Use near-cli to set increment the counter
near call <contract-account-id> increment --accountId --accountId <your-account>
```

## Useful Links

- [cargo-near](https://github.com/near/cargo-near) - NEAR smart contract
  development toolkit for Rust
- [near CLI-rs](https://near.cli.rs) - Iteract with NEAR blockchain from command
  line
- [NEAR Rust SDK Documentation](https://docs.near.org/sdk/rust/introduction)
- [NEAR Documentation](https://docs.near.org)
- [NEAR StackOverflow](https://stackoverflow.com/questions/tagged/nearprotocol)
- [NEAR Discord](https://near.chat)
- [NEAR Telegram Developers Community Group](https://t.me/neardev)
- NEAR DevHub: [Telegram](https://t.me/neardevhub),
  [Twitter](https://twitter.com/neardevhub)
