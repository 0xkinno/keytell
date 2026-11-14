# Proof plan

Every result lands in docs/FACTS.json, generated from committed files.

| Proof | Where |
|---|---|
| External ground truth: USDC volume from BigQuery `ft_events`, not built from key data | sql/05, Brief 1.1 |
| Baselines: DAA and price, each at its own best in-sample lag | analysis/method.py, Brief 1.2 |
| Pre-registration on chain before the out-of-sample run | data/registration.json, /ledger, /proof (registration 18:17:43 UTC; first out-of-sample query 18:18:03 UTC) |
| Placebo: 1,000 circular shifts | analysis/controls.py, Brief 2.2 |
| Concentration exclusion | analysis/controls.py, Brief 2.3 |
| Wild set: the 50 contracts function-call keys are scoped to most often, with links, signers and methods; the labelling rule published first, a mechanical proposal for the rules that need no judgement, and a column for the person's label | analysis/wild_set.py, docs/WILD_SET.md, data/wild_set_labels.csv |
| Counterfactual: the committee with DAA only | data/out/directions.csv, Brief 2.4 |
| Both error directions and misses | data/out/directions.csv, Brief 2.4 |
| Fault switch: KEYTELL_FAULT=stale_bq, intents_down, rpc_down | /api/status, /api/lookup |
| Break campaign: 16 attempts on testnet, each refused or accepted as designed | scripts/break.ts, data/break.json, /ledger |
| Cost per rebuild and per observation | data/out/bq_runs.jsonl, /rerun |
| Surprising finding | docs/FINDINGS.md |

The proof can come out against us. The backtest failed: the registered code wrote "The data did not
support the claim" to results.json, and every page leads with it in plain words ("The claim did not
hold"). The build is still complete.
