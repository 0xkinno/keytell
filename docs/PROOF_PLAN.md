# Proof plan

Every result lands in docs/FACTS.json, generated from committed files.

| Proof | Where |
|---|---|
| External ground truth: USDC volume from BigQuery `ft_events`, not built from key data | sql/05, Brief 1.1 |
| Baselines: DAA and price, each at its own best in-sample lag | analysis/method.py, Brief 1.2 |
| Pre-registration on chain before the out-of-sample run | data/registration.json, /ledger, /proof (registration 18:17:43 UTC; first out-of-sample query 18:18:03 UTC) |
| Placebo: 1,000 circular shifts | analysis/controls.py, Brief 2.2 |
| Concentration exclusion | analysis/controls.py, Brief 2.3 |
| Wild set: the contracts function-call keys are scoped to, ranked, with links | data/out/fc_receivers.csv, Brief 2.3. Labels are not assigned by a person in this build; the list is published unlabelled rather than labelled by the build agent |
| Counterfactual: the committee with DAA only | data/out/directions.csv, Brief 2.4 |
| Both error directions and misses | data/out/directions.csv, Brief 2.4 |
| Fault switch: KEYTELL_FAULT=stale_bq, intents_down, rpc_down | /api/status, /api/lookup |
| Break campaign: 16 attempts on testnet, each refused or accepted as designed | scripts/break.ts, data/break.json, /ledger |
| Cost per rebuild and per observation | data/out/bq_runs.jsonl, /rerun |
| Surprising finding | docs/FINDINGS.md |

The proof can come out against us. If the backtest fails, the headline says "The data did not
support the claim", and the build is still complete.
