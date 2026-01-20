# NEAR Playground Factory Contract

This factory contract enables wallet-based contract deployment for NEAR Playground.

## Why a Factory?

NEAR wallets (MyNearWallet, Sender, HERE, etc.) don't support the `DeployContract` action for security reasons. They only expose function-call keys to web apps, not full-access keys.

The factory pattern solves this by:
1. User calls `factory.deploy_contract()` via `FunctionCall` (supported by all wallets)
2. Factory creates a sub-account: `my-contract.factory.nearplay.testnet`
3. Factory deploys the user's code to that sub-account
4. Factory adds user's public key as full-access key
5. User now controls the deployed contract via their wallet

## Build

```bash
cd contracts/factory
cargo near build --release
```

## Deploy

### Testnet
```bash
near deploy factory.nearplay.testnet \
  --wasmFile target/near/nearplay_factory.wasm \
  --initFunction new \
  --initArgs '{"owner": "nearplay.testnet"}'
```

### Mainnet
```bash
near deploy factory.nearplay.near \
  --wasmFile target/near/nearplay_factory.wasm \
  --initFunction new \
  --initArgs '{"owner": "nearplay.near"}'
```

## Usage

### Deploy a Contract
```bash
near call factory.nearplay.testnet deploy_contract \
  '{"name": "my-contract", "code": [/* WASM bytes */]}' \
  --accountId yourname.testnet \
  --deposit 3 \
  --gas 300000000000000
```

The contract will be deployed to: `my-contract.factory.nearplay.testnet`

### Check Name Availability
```bash
near view factory.nearplay.testnet is_name_available '{"name": "my-contract"}'
```

### Get Deployment Info
```bash
near view factory.nearplay.testnet get_contract_info \
  '{"account_id": "my-contract.factory.nearplay.testnet"}'
```

## Methods

### Change Methods (require transaction)

- `deploy_contract(name: String, code: Vec<u8>)` - Deploy contract to sub-account
- `deploy_and_init(name, code, init_method, init_args)` - Deploy and call init

### View Methods (free)

- `get_contract_info(account_id)` - Get info about a deployed contract
- `get_deployment_count()` - Total deployments
- `is_name_available(name)` - Check if name is available
- `get_recent_deployments(limit)` - List recent deployments
- `get_min_deposit()` - Get minimum deposit required (in yoctoNEAR)

## Minimum Deposit

Deploying a contract requires at least 2 NEAR to cover:
- Account creation fee
- Storage for the contract code
- Initial balance for the new account

Recommended: 3 NEAR for safety margin.
