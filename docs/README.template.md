<div align="center">

<img src="app/public/icon.svg" width="72" alt="Keytell mark: a small copper key" />

# Keytell

**On NEAR, do transactions signed by function-call keys show real usage before daily active accounts or price do?**

Pre-registered on NEAR before the test data existed. Rebuild every number with one command.

[Live app]({{app.url}}) · [Evidence]({{app.url}}/evidence) · [Against]({{app.url}}/against) · [Ledger]({{app.url}}/ledger) · [Proof]({{app.url}}/proof) · Video: link at submission

[![CI]({{repo.url}}/actions/workflows/ci.yml/badge.svg)]({{repo.url}}/actions/workflows/ci.yml) [![Live checks]({{repo.url}}/actions/workflows/live.yml/badge.svg)]({{repo.url}}/actions/workflows/live.yml) [![MIT](https://img.shields.io/badge/licence-MIT-informational)](LICENSE)

<img src="docs/screens/hero.png" width="900" alt="Keytell hero: the claim and the Key Wall, one key per week coloured by the share of transactions signed by function-call keys" />

</div>

## The verdict first

**{{backtest.verdict}}.** {{sentences.verdict}}

{{sentences.vs_baselines}}

The forward claim on chain is **{{claim.status_at_last_crank}}**: twelve weeks from {{windows.forward_start}}, resolved by anyone after the window, by the contract, from posted weeks.

## At a glance

| | |
|---|---|
| For | A research analyst who must tell an investment committee whether NEAR usage is real or bots and farmers (Tolu Adeyemi, fictional) |
| What it does | Classifies the key that signed each sampled mainnet transaction, tests whether function-call-signed activity forecasts USDC volume better than DAA or price, publishes the case against with the same weight, and exports a memo the analyst signs |
| Why NEAR | Only NEAR has protocol-level function-call keys: a key bound to one contract that cannot attach NEAR. Which kind of key signed is public state, per transaction |
| Verdict (backtest) | {{backtest.verdict}}, over {{backtest.oos_weeks_scored}} out-of-sample weeks |
| Forward claim on chain | `{{claim.id}}` on `{{claim.ledger}}`, {{claim.status_at_last_crank}}, {{claim.forward_weeks}} weeks from {{windows.forward_start}} |
| Function-call share, latest week | {{latest.fc_share|pct}} in {{latest.week}} (interval {{latest.fc_share_lo|pct}} to {{latest.fc_share_hi|pct}}) |
| Track | 02 Investment Thesis |
| Built with | near-sdk 5.29, near-workspaces, cargo-near reproducible build, NEP-297, NEP-330, NEP-366, NEP-413, near-connect, BigQuery `crypto_near_mainnet_us`, FastNEAR, Next.js 16, d3 |

## See it on chain

| What | Where |
|---|---|
| The claim registered, before any out-of-sample query | [{{claim.registration_tx|short}}...](https://testnet.nearblocks.io/txns/{{claim.registration_tx}}) at {{claim.registered_at}}; first out-of-sample query {{first_oos_query_at}} |
| Ledger deployed and initialised in one transaction | [{{deployment.txs.deploy_and_init|short}}...](https://testnet.nearblocks.io/txns/{{deployment.txs.deploy_and_init}}) |
| Ledger sealed: its only key deleted | [{{deployment.txs.seal_ledger|short}}...](https://testnet.nearblocks.io/txns/{{deployment.txs.seal_ledger}}); access keys now {{deployment.ledger_access_keys}} |
| The crank's post-only function-call key added | [{{deployment.txs.crank_fc_key|short}}...](https://testnet.nearblocks.io/txns/{{deployment.txs.crank_fc_key}}) |
| A refusal (break campaign) | see `data/break.json`: {{break_campaign.refusals}} attempts, all behaved as designed: {{break_campaign.all_refused_as_designed|bool}} |
| Resolve | opens after the forward window ends; `/ledger` counts down |

## Monday 07:40

Tolu Adeyemi (fictional), research analyst at a crypto fund in Lagos, has twenty minutes before the
investment committee. The partner asks: "Is anyone actually using NEAR, or is it bots and airdrop
farmers?" Every dashboard Tolu can open shows daily active accounts and price. Both are cheap to
fake. Today Tolu screenshots a DAA chart and says "activity is up"; the committee sizes the position
on conviction.

| What is true | Source |
|---|---|
| NEAR records which kind of key signed every transaction | [docs.near.org, access keys](https://docs.near.org/protocol/accounts-contracts/access-keys) |
| "`Function Call Keys` are meant to be shared with applications" | same page |
| Function-call keys "do not allow to attach NEAR tokens to the call" | same page |

With Keytell, Tolu opens one page: the claim fixed on chain first, the evidence for, the evidence
against, the SQL behind every chart, a lookup that classifies any account, and a memo to sign.
Tolu decides; Keytell never says buy. The NEP-413 signature on the memo is Tolu's attestation that
the evidence against was read.

## The claim

> {{claim.statement}}

Registered at {{claim.registered_at}} in `{{claim.ledger}}`. Method hash `{{claim.method_sha256|short}}...` ([docs/METHOD.md](docs/METHOD.md)); code manifest hash `{{claim.sql_sha256|short}}...` ([docs/CODE_MANIFEST.sha256](docs/CODE_MANIFEST.sha256)); data commit `{{claim.data_commit|short}}`. Both hashes match the repository: method {{claim.method_sha256_matches_repo|bool}}, manifest {{claim.sql_sha256_matches_repo|bool}}.

## The evidence for

- {{sentences.verdict}}
- {{sentences.latest}}
- {{sentences.sample_check}}
- Best in-sample lags: function-call-signed {{backtest.best_in_sample_lag.fc_signed_tx}} weeks, DAA {{backtest.best_in_sample_lag.daa}}, price {{backtest.best_in_sample_lag.price}}.

## The evidence against

We lead with it as hard as with the case for.

- {{sentences.placebo}}
- {{sentences.concentration}}
- {{sentences.directions}}
- Control reruns (concentration, relayers, unknown keys, episodes): see [/against]({{app.url}}/against) and `data/out/controls.json`.
- Largest weekly share of keys nobody could read: {{data.max_unknown_share|pct}}. Weeks above 5 percent in the scored window: {{data.weeks_unknown_over_5pct|list}}.

## What would change this conclusion

- The forward claim failing on chain: fewer than half of the {{claim.forward_weeks}} forward weeks won.
- A control breaking the result on new weeks.
- DAA or price forecasting USDC volume as well over the same weeks.

## How it works

```mermaid
flowchart LR
  A[FastNEAR block archive<br/>60 blocks a week] --> S[sampler<br/>key at signing time]
  R[public RPC<br/>view_access_key] --> S
  B[BigQuery<br/>transactions, ft_events] --> C[census<br/>DAA, tx, USDC]
  P[Coin Metrics<br/>price] --> W
  S --> W[weekly series]
  C --> W
  W --> M[pre-registered test<br/>and controls]
  M --> F[FACTS.json]
  F --> APP[app, README, memo]
  L[thesis_ledger on NEAR<br/>claim and hashes] --> APP
  K[crank<br/>function-call key] --> L
```

1. `scripts/sample-chain.ts` draws 60 seeded random blocks per ISO week, then 200 seeded random transactions, and classifies each signing key at signing time over public RPC (now, or at the block before signing on archival RPC).
2. `sql/04` and `sql/05` count transactions, daily active accounts and USDC transfers on BigQuery.
3. `analysis/method.py` chooses each signal's lag on the in-sample window, then scores expanding-window one-step forecasts out of sample. `analysis/controls.py` reruns it under every control.
4. `scripts/facts.ts` writes `docs/FACTS.json`; the app, this README and the memo read only from it.
5. `contracts/thesis_ledger` holds the claim. No edit or upgrade method, zero keys. The crank posts each forward week with a key limited to `post`.

## Why only NEAR

- **Access key types.** A function-call key is bound to one receiver, optional methods and a gas allowance, and cannot attach NEAR. Apps hold these keys for users. Every signature's key kind is public and can be read at any block.
- **Meta transactions.** NEP-366 delegate actions separate the relayer's signature from the user's; Keytell counts the user's.
- **Implicit accounts.** A 64-hex account signs with the key its name derives from; Keytell recognises it.

## Measured

| Measure | Value | Source |
|---|---|---|
| Out-of-sample gain, function-call-signed | {{backtest.oos_gain.fc_signed_tx|pct}} | data/out/results.json |
| Out-of-sample gain, DAA | {{backtest.oos_gain.daa|pct}} | same |
| Out-of-sample gain, price | {{backtest.oos_gain.price|pct}} | same |
| Out-of-sample gain, function-call share | {{backtest.oos_gain.fc_share|pct}} | same |
| Out-of-sample gain, transaction count | {{backtest.oos_gain.tx_count|pct}} | same |
| Hits, false alarms, misses (function-call) | {{backtest.directions.fc_signed_tx.hits}}, {{backtest.directions.fc_signed_tx.false_alarms}}, {{backtest.directions.fc_signed_tx.misses}} | data/out/directions.csv |
| Hits, false alarms, misses (DAA only) | {{backtest.directions.daa.hits}}, {{backtest.directions.daa.false_alarms}}, {{backtest.directions.daa.misses}} | same |
| Placebo share beaten | {{controls.placebo.share_beaten|pct0}} of {{controls.placebo.reps}} | data/out/placebo.csv |
| Weeks sampled | {{data.weeks_sampled}} ({{data.first_week}} to {{data.last_week}}) | data/raw/sample |
| Blocks sampled, transactions classified | {{data.blocks_sampled|int}}, {{data.transactions_classified|int}} | same |
| Archival key lookups | {{data.archival_lookups|int}} | same |
| Census through | {{data.census_last_day}} | data/out/bq_runs.jsonl |
| Cost per census rebuild | {{cost.rebuild_gb}} GB, about ${{cost.rebuild_usd_at_on_demand_price}} at the on-demand price | same |

## Try it in two minutes

1. Open [/keys]({{app.url}}/keys), type `aurora` or `relay.tg`: see its keys marked function-call or full access, and its recent transactions classified by the key that signed them.
2. Open [/proof]({{app.url}}/proof): see every check run in your browser against NEAR testnet.
3. Run `make verify` from a clean clone (Node 22, Python 3.12, no keys): see PASS lines and exit 0.

## Judging criteria

| Criterion | Where to look |
|---|---|
| Technical implementation | keyless sampler classifying keys at signing time; census SQL tested on fixtures; a keyless ledger with 21 unit tests, a 10,000-case property test, a sandbox test and a 16-attempt break campaign; reproducible build; `make verify` with a tamper check |
| Design | the Assay system ([docs/DESIGN.md](docs/DESIGN.md)); the Key Wall is the data; 8 viewports, axe WCAG 2.2 AA |
| Impact | an analyst's question answered with a claim that could not be tuned, and a memo the analyst signs |
| Originality | a NEAR-only signal (key kind per signature), pre-registered on NEAR, observed by the kind of key it counts |
| Sustainability | a weekly crank and live checks; every number rebuilds from public data; the forward claim resolves without us |

## Live, substituted, designed

| Live | Substituted | Designed (labelled degraded states) |
|---|---|---|
| Ledger, claim, observations, crank key, proof checks: NEAR testnet | Ledger on testnet, not mainnet (the data is mainnet); price from Coin Metrics because CoinGecko's public API covers 365 days only; `/keys` transactions from FastNEAR because NearBlocks rate-limited this build | `KEYTELL_FAULT=stale_bq`, `intents_down`, `rpc_down` |

## Limits

- The key mix is a sample: {{data.transactions_classified|int}} transactions classified over {{data.weeks_sampled}} weeks, with intervals. The full ADD_KEY ledger would scan about 20 TB.
- USDC volume before 2023-10-16 is not in the census (USDC.e logged no NEP-141 events until 2023-10-11), so earlier weeks are shown, not scored.
- The contract resolves on the observations the crank posts. Trust in those numbers comes from `make verify` (anyone recomputes them from public data and compares hashes), not from the contract.
- Retention and NEAR Intents volume are not computable within this build (scan budget; no partner key).
- The ledger runs on testnet.

## Disclosures

- AI tools: built with an AI coding agent under the author's direction. Libraries and data are listed above; data licences: BigQuery public dataset terms, Coin Metrics Community Data (attribution), FastNEAR public endpoints.
- Tolu Adeyemi is a fictional persona.
- Nothing here is investment advice.
- **Other project by the same builder in this hackathon: Berthright (NFTs That Do Something), github.com/0xkinno/berthright.** The two are independent.

## Run it

```bash
git clone {{repo.url}} && cd keytell
make setup
make verify
```

```bash
make sample FROM=2025-01-06 TO=2025-01-06
```

```bash
make test
```

## Repository map

| Path | What |
|---|---|
| `contracts/thesis_ledger` | the pre-registration ledger (Rust, near-sdk 5.29) |
| `scripts/sample-chain.ts`, `scripts/lib/classify.ts` | the keyless sampler and key classifier |
| `sql/` | census queries with dry-run bytes in each header |
| `analysis/` | weekly series, pre-registered test, controls, memo |
| `scripts/` | facts, verify, register, crank, break, readme, checks |
| `data/` | committed inputs and outputs, registration, break campaign |
| `app/` | the Next.js site |
| `docs/` | METHOD, FACTS, MOMENT, RISK, PROOF_PLAN, FINDINGS, DESIGN, SDK_SURFACE, EVIDENCE |

## Licence

MIT. See [LICENSE](LICENSE).
