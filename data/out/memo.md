# Investment memo: is NEAR usage real?

Prepared with Keytell for an investment committee. Analyst: Tolu Adeyemi (illustrative persona). Not investment advice.

## The question
Is anyone actually using NEAR, or is it bots and airdrop farmers? Daily active accounts and price are cheap to fake, so this memo tests a signal that is harder to fake: transactions signed by function-call keys, the scoped keys apps and agents use.

## The claim, fixed before the data
> On NEAR, the volume of transactions signed by function-call keys is a better leading indicator of real application usage than daily active accounts or token price.

Registered on NEAR testnet at 2026-11-13T18:17:43.113Z in `ledger.keytell.testnet` (claim `keytell-fc-leads-usdc-1`), before any out-of-sample query ran: [registration transaction](https://testnet.nearblocks.io/txns/FpHj8UhHEyVQBWhafiY4pQH3UzQpPf2wKXvDFVhTYZQo). Method hash `90f687b9d36d7ef6...` ([docs/METHOD.md](https://github.com/0xkinno/keytell/blob/main/docs/METHOD.md)), code manifest hash `47e2d8be113495fc...`. Both match the repository: yes.

## What the test found
- Result: **The claim did not hold.** Out of sample, function-call keys did not forecast weekly USDC volume better than daily active accounts or price. The data is complete and the test ran exactly as registered; the thesis failed it, and Keytell publishes that. ([results.json](https://github.com/0xkinno/keytell/blob/main/data/out/results.json)).
- Out-of-sample gain in forecasting weekly USDC volume over 94 weeks, against an AR(2) baseline (positive means a smaller error than the baseline, negative a larger one): function-call-signed activity -5.1%, daily active accounts -3.6%, price -5.5% ([oos_errors.csv](https://github.com/0xkinno/keytell/blob/main/data/out/oos_errors.csv)).
- Mean squared-error difference against DAA 0.006578 (95% interval -0.055139 to 0.069399); against price -0.001606 (-0.060525 to 0.05815). Negative favours function-call keys.
- In 2026-W45, 29.5% of sampled mainnet transactions were signed by a function-call key (interval 23.6% to 36.2%) ([weekly.csv](https://github.com/0xkinno/keytell/blob/main/data/out/weekly.csv)).

## The controls
- 1 of 8 control reruns would pass the registered rule: relayers all delegated as fc ([controls.json](https://github.com/0xkinno/keytell/blob/main/data/out/controls.json)). These are registered controls, not the headline, so they do not change the verdict.
- Timing placebo: the real gain beats 9% of 1000 shifted placebos; the bar is 95% ([placebo.csv](https://github.com/0xkinno/keytell/blob/main/data/out/placebo.csv)).
- Concentration: the ten most common function-call scopes carry 91.4% of sampled function-call transactions ([fc_receivers.csv](https://github.com/0xkinno/keytell/blob/main/data/out/fc_receivers.csv)).
- Errors in both directions, out of sample: 15 false alarms and 24 misses against 13 hits ([directions.csv](https://github.com/0xkinno/keytell/blob/main/data/out/directions.csv)).
- The key mix is a sample (50600 transactions classified), not a census; USDC volume before 2023-10-16 is not in the census.

## What would change this conclusion
- The forward claim on chain succeeding: at least half of the 12 forward weeks won, resolved by anyone after the window. That is new evidence, not a rerun of these weeks.
- A new pre-registered claim, written down before its data, that holds out of sample. Picking a passing control after the fact would not count.
- The weekly USDC census proving wrong or incomplete in a way that changes the out-of-sample errors.

## Rebuild it
`git clone https://github.com/0xkinno/keytell && cd keytell && make verify` recomputes every number here from committed outputs and checks the hashes posted on chain. A full census rebuild scans 179.7 GB on BigQuery ([bq_runs.jsonl](https://github.com/0xkinno/keytell/blob/main/data/out/bq_runs.jsonl)).

## Analyst attestation
I have read the evidence against as well as the evidence for, and the decision is mine. Signature below (NEP-413).
