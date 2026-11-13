# NEAR surface used

| Surface | Where | Why |
|---|---|---|
| near-sdk 5.29 (`#[near]`, `IterableMap`, `LookupMap`, `env::storage_usage`, `Promise::transfer`) | contracts/thesis_ledger | the keyless pre-registration ledger |
| NEP-297 events (`EVENT_JSON`, standard `keytell`) | contracts/thesis_ledger/src/events.rs | rebuild claims and observations from logs |
| NEP-330 `contract_source_metadata` | contract attribute | build image, commit and link on chain |
| Function-call access key (`AddKey` with `FunctionCall { receiver_id, method_names: ["post"], allowance }`) | fleet/deploy-testnet.ts | the crank signs the way the thesis says apps sign |
| Deleting the deployer key | fleet/deploy-testnet.ts | the ledger holds zero keys: nobody can upgrade or edit it |
| `view_access_key` at a block hash (archival) and now | scripts/sample-chain.ts | classify each signing key at signing time |
| `view_access_key_list` | app/api/lookup, /ledger, /proof | list any account's keys; show the crank's key |
| `query` `call_function`, `view_account`, `block`, `status` | app/lib/near.ts | live reads in the browser |
| NEP-366 delegate actions | sampler and lookup | classify meta transactions by the inner signer |
| NEP-413 signed messages (`near-api-js/nep413` `verifyMessage`, near-connect `signMessage`) | /memo, /api/memo-verify | the analyst's attestation |
| near-connect (`@hot-labs/near-connect`) | app/lib/wallet.ts | wallet for the memo signature and `resolve` |
| near-workspaces 0.22 sandbox | contracts/thesis_ledger/tests/sandbox.rs | every refusal as a real failed transaction |
| cargo-near reproducible image (`sourcescan/cargo-near:0.22.0-rust-1.97.1`) | fleet/repro-build.sh | the on-chain code hash rebuilds from the commit |
| near-cli-rs faucet sponsor | account creation | `keytell.testnet` |
| BigQuery `crypto_near_mainnet_us` | sql/ | census of transactions, active accounts and USDC events |
| FastNEAR block archive and transaction API | sampler, /keys | keyless blocks and transactions |
