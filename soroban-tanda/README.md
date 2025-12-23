# Tanda Smart Contract (Soroban)

Smart contract for Tanda (ROSCA - Rotating Savings and Credit Association) on Stellar/Soroban.

## Prerequisites

1. Install Rust:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

2. Add Soroban target:
```bash
rustup target add wasm32-unknown-unknown
```

3. Install Soroban CLI:
```bash
cargo install --locked soroban-cli
```

## Build

```bash
cargo build --target wasm32-unknown-unknown --release
```

The compiled WASM will be at:
`target/wasm32-unknown-unknown/release/tanda_contract.wasm`

## Deploy to Testnet

1. Configure Stellar testnet:
```bash
soroban network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
```

2. Generate a keypair:
```bash
soroban keys generate admin --network testnet
soroban keys address admin
```

3. Fund the account (use Stellar Friendbot):
```bash
curl "https://friendbot.stellar.org?addr=$(soroban keys address admin)"
```

4. Deploy:
```bash
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/tanda_contract.wasm \
  --source admin \
  --network testnet
```

5. Initialize:
```bash
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source admin \
  --network testnet \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS> \
  --eurc_token <EURC_TOKEN_ADDRESS> \
  --commission_address <COMMISSION_ADDRESS> \
  --commission_rate 50
```

## Contract Functions

### Admin Functions

- `initialize(admin, eurc_token, commission_address, commission_rate)` - Initialize contract

### Tanda Management

- `create_tanda(creator, name, contribution, frequency_days, max_members)` - Create new tanda
- `join_tanda(user, tanda_id)` - Request to join a tanda
- `approve_member(creator, tanda_id, member_address)` - Approve a pending member
- `start_tanda(creator, tanda_id)` - Start the tanda (begins cycles)

### Deposits & Payouts

- `deposit(user, tanda_id)` - Make a deposit for current cycle
- `process_payout(tanda_id)` - Process payout for current cycle

### Views

- `get_tanda(tanda_id)` - Get tanda details
- `get_members(tanda_id)` - Get tanda members
- `get_user_tandas(user)` - Get user's tandas
- `has_deposited(tanda_id, cycle, user)` - Check if user deposited

## Commission

Commission is charged on each deposit:
- Rate is in basis points (50 = 0.5%)
- Sent directly to commission address
- Example: For 100 EURC deposit with 0.5% commission = 0.50 EURC commission

## Test

```bash
cargo test
```
