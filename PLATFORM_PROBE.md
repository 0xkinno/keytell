# Platform probe

Every line below comes from a real call made on 13 Nov 2026 from the build container. Raw BigQuery
answers are committed in `data/probe/*.json` with the query and its dry-run bytes.

## Kill rule

> If no source can classify signer keys, stop and report.

**Not triggered.** Two independent sources classify a signing key at signing time:

1. Archival RPC `view_access_key` at a past block hash. For transaction
   `AGcSDDb918RLpvbGnGiUvA52EQmqdE54QgdCqykJSpdc` (block 58,000,000, January 2022, signer
   `deanhoffa.near`), the query at the block's `prev_hash` returned
   `{"block_height":57999999,"nonce":41846051000065,"permission":"FullAccess"}`.
2. BigQuery `receipt_actions` `ADD_KEY` / `DELETE_KEY` rows carry the full permission in `args`
   (below), so the census key ledger can be built in SQL. It is not run because of its size.

## BigQuery: `bigquery-public-data.crypto_near_mainnet_us`

Access: a service account in the sandbox project with BigQuery Job User and BigQuery Data Editor.
The first attempt failed with `User does not have bigquery.jobs.create permission`; it worked after
the roles were granted.

**Tables** (`data/probe/tables.json`): `account_changes`, `accounts` (view), `blocks`, `chunks`,
`circulating_supply`, `execution_outcomes`, `ft_balances_daily`, `ft_events`,
`ft_events_contracts_by_account` (materialized view), `nft_events`,
`nft_events_contracts_by_account` (materialized view), `receipt_actions`, `receipt_details`,
`receipt_origin_transaction`, `transaction_actions`, `transactions`. There is no `receipts` view and
no `chunks`-level transaction list; `transaction_actions` and `ft_events` exist but are not in the
docs' list.

**Columns we use** (`data/probe/columns.json`):

- `transactions`: `block_date DATE`, `block_timestamp INT64`, `transaction_hash`, `signer_account_id`,
  **`signer_public_key STRING`** (the signing key column), `nonce INT64`, `receiver_account_id`,
  `status STRING`.
- `receipt_actions`: `block_date`, `block_timestamp`, `receipt_id`, `index_in_action_receipt`,
  `signer_account_id`, `signer_public_key`, `args STRING` (JSON), `action_kind STRING`,
  `receipt_receiver_account_id`, `is_delegate_action BOOL`.
- `transaction_actions`: `transaction_hash`, `signer_account_id`, `signer_public_key`,
  `receiver_account_id`, `action_kind`, `args STRING` (JSON).
- `ft_events`: `block_date`, `contract_account_id`, `affected_account_id`, `involved_account_id`,
  `delta_amount STRING`, `cause STRING`, `status STRING`, `standard STRING`.

**Date range** (partition metadata, `data/probe/date_range.json`): `transactions` from 2020-07-23
to **2026-11-13** (2,294 days, 5,486,112,855 rows). History did **not** stop at the NEAR Lake
deprecation date (24 Mar 2026): the dataset is current. `ft_events` from 2022-02-23 to 2026-11-13.

**ADD_KEY argument paths** (`add_key_sample.json`, `add_key_function_call_sample.json`):

```json
{"access_key":{"nonce":0,"permission":"FullAccess"},"public_key":"ed25519:1f2Ui9..."}
{"access_key":{"nonce":0,"permission":{"FunctionCall":{"allowance":"250000000000000","method_names":[],"receiver_id":"social.near"}}},"public_key":"ed25519:BjeQhu..."}
```

So: `$.public_key`; `$.access_key.permission` is the string `FullAccess` or an object at
`$.access_key.permission.FunctionCall.{receiver_id, method_names, allowance}`.
`DELETE_KEY`: `{"public_key":"ed25519:3F4a9t..."}`.

**DELEGATE** (`action_kinds.json`, `delegate_action_sample.json`): the action kind is
`DELEGATE_ACTION` (3,918,513 receipt actions on 2025-01-15). In `transaction_actions.args`:
`$.Delegate.delegate_action.{sender_id, public_key, receiver_id, actions, nonce}`; the outer
transaction is signed by the relayer (for example `relay.tg`), the inner action by the user's key.

**USDC in `ft_events`**: native USDC events from 2022-11-29; bridged USDC.e
(`a0b86991...factory.bridge.near`) only from 2023-10-11, when it began emitting NEP-141 events.
Causes seen for USDC (2025-01-13 to 19): `ft_transfer` with statuses `SUCCESS_VALUE` and
`SUCCESS_RECEIPT_ID`, plus a handful of `ft_mint` and `ft_burn`.

**Costs** (dry runs, `data/out/bq_runs.jsonl`): daily DAA and transactions 2022-01-03 to 2026-11-08
153.7 GB; USDC 20.3 GB; deploys 481.4 GB (not run); retention 153.7 GB (not run); one day of the
ADD_KEY ledger 8.5 to 10.2 GB (about 20 TB from genesis, not run).

## Block and key sources (the keyless sampler)

| Source | Result |
|---|---|
| FastNEAR block archive `mainnet.neardata.xyz/v0/block/{h}` | 200, full blocks with chunks, transactions (`signer_id`, `public_key`, `nonce`, actions) and receipt execution outcomes with logs; about 110 to 200 KB per block; `null` for skipped heights |
| Archival RPC `archival-rpc.mainnet.fastnear.com` | answers `view_access_key` at any block; rate-limited (429) after a few hundred fast calls; documented as paid-only for archival, so the sampler paces it at 4 per second |
| `archival-rpc.mainnet.near.org` | "severely rate limited" per the docs; 429 within seconds here; used only as a fallback |
| Current-state RPC: `rpc.mainnet.fastnear.com`, `free.rpc.fastnear.com`, `rpc.intea.rs`, `api.zan.top/near-mainnet` | each sustains about 3 requests per second for uncached key lookups; ZAN about 2; the sampler spreads lookups across all four |
| FastNEAR transaction API `tx.main.fastnear.com/v0/account`, `/v0/transactions` | account history and full transactions with `public_key`; `/transactions` caps a batch at 20 hashes |

## Other series

| Source | Result |
|---|---|
| NearBlocks API v3 | `/v3/stats` and `/v3/txns` answered once; `/v1/charts` returned 429 "exceeded your API request limit" on every try; not used |
| CoinGecko `market_chart` | public callers limited to the last 365 days (error 10012); cannot cover 2022 to 2024; not used |
| Coin Metrics Community API | `PriceUSD` for `near`, daily, 2021-12-01 to 2026-11-12, free, no key: used for price (`data/raw/price.csv`) |
| NEAR Intents Explorer | `/api/v0/openapi.yaml` reachable; every data endpoint needs a partner JWT (one request per 5 seconds); no JWT in this build, so Intents volume is reported as not computable |
| Circle docs | native USDC on NEAR: `17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`; `ft_metadata` confirms `USDC`, 6 decimals; USDC.e `ft_metadata` says `Bridged USDC`, 6 decimals |
| `registry.hos` (House of Stake names) | not probed for this build's analysis; the leased-name side series is out of scope (see TASK) |

## Testnet

`keytell.testnet` created with the NEAR CLI faucet sponsor (10 testnet NEAR), transaction
`Hd3G6UodE3BM5md1kwKKbUnsu96a7gcPHE5ynE8auto4`. Testnet RPC: `rpc.testnet.fastnear.com`.
