# Investment memo: is NEAR usage real?

Prepared with Keytell for an investment committee. Analyst: Tolu Adeyemi (fictional). Not investment advice.

## The question
Is anyone actually using NEAR, or is it bots and airdrop farmers? Daily active accounts and price are cheap to fake, so this memo tests a signal that is harder to fake: transactions signed by function-call keys, the scoped keys apps and agents use.

## The claim, fixed before the data
> On NEAR, the volume of transactions signed by function-call keys is a better leading indicator of real application usage than daily active accounts or token price.

Registered on NEAR testnet at 2026-11-13T18:17:43.113Z in `ledger.keytell.testnet` (claim `keytell-fc-leads-usdc-1`), before any out-of-sample query ran: [registration transaction](https://testnet.nearblocks.io/txns/FpHj8UhHEyVQBWhafiY4pQH3UzQpPf2wKXvDFVhTYZQo). Method hash `90f687b9d36d7ef6...` ([docs/METHOD.md](https://github.com/0xkinno/keytell/blob/main/docs/METHOD.md)), code manifest hash `47e2d8be113495fc...`. Both match the repository: True.

## Evidence for
- In 2023-W44, 3.5% of sampled mainnet transactions were signed by a function-call key (interval 1.7% to 7.0%) ([weekly.csv](https://github.com/0xkinno/keytell/blob/main/data/out/weekly.csv)).

## Evidence against
- Concentration: the ten most common function-call scopes carry 95.1% of sampled function-call transactions ([fc_receivers.csv](https://github.com/0xkinno/keytell/blob/main/data/out/fc_receivers.csv)).
- The key mix is a sample (5600 transactions classified), not a census; USDC volume before 2023-10-16 is not in the census.

## What would change this conclusion
- The forward claim on chain failing: fewer than half of the 12 forward weeks won, resolved by anyone after the window.
- A control that breaks the result when rerun on new weeks: concentration, relayer treatment, unknown keys, or placebo.
- DAA or price forecasting USDC volume as well as function-call activity over the same weeks.

## Rebuild it
`git clone https://github.com/0xkinno/keytell && cd keytell && make verify` recomputes every number here from committed outputs and checks the hashes posted on chain. A full census rebuild scans 179.7 GB on BigQuery ([bq_runs.jsonl](https://github.com/0xkinno/keytell/blob/main/data/out/bq_runs.jsonl)).

## Analyst attestation
I have read the evidence against as well as the evidence for, and the decision is mine. Signature below (NEP-413).
