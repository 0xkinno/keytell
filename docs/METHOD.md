# Method (pre-registered)

This document, the SQL in `sql/`, the sampler in `scripts/`, and the analysis in `analysis/` were
committed, hashed, and registered on NEAR testnet (`ledger.keytell.testnet`, claim
`keytell-fc-leads-usdc-1`) **before** any out-of-sample query ran and before the forward window
opened. The SHA-256 of this file is the claim's `method_sha256`. The SHA-256 of
`docs/CODE_MANIFEST.sha256` (one line per SQL, sampler and analysis file with its own SHA-256) is
the claim's `sql_sha256`. Any later change to this method is listed under Deviations with its
reason; nothing here is edited silently.

## 1. The claim

> On NEAR, the volume of transactions signed by function-call keys is a better leading indicator
> of real application usage than daily active accounts or token price.

## 2. Unit and transform

- Unit: ISO week, Monday 00:00 UTC to the next Monday.
- Transform: log change week over week, `ln(x_t) - ln(x_{t-1})`. Weeks with a zero or missing value
  are gaps, never filled.

## 3. Series

**Candidates (X)**

| Name | Definition | Source |
|---|---|---|
| `fc_signed_tx` (headline) | FC share x census transaction count | share: keyless block sample; count: BigQuery |
| `fc_share` | share of sampled transactions in buckets FUNCTION_CALL or DELEGATED_INNER_FC | keyless block sample |
| `daa` | weekly mean of daily distinct transaction signers | BigQuery `transactions` (sql/04) |
| `tx_count` | weekly sum of daily transactions | BigQuery `transactions` (sql/04) |
| `price` | weekly mean of daily NEAR/USD reference price | Coin Metrics Community API |

**Outcome (Y), fixed before testing**

- Primary: weekly USDC transfer volume on NEAR, the receiving side of every successful NEP-141
  `ft_transfer` event on native USDC (`17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1`,
  from Circle's documentation) and bridged USDC.e (`a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near`).
  Source: BigQuery `ft_events` (sql/05).
- Secondary, reported but not part of the pass rule: weekly USDC transfer count (sql/05); contract
  deploys estimated from the block sample.
- Not computable within this build: 30-day retained signers (needs per-week signer sets; the
  `transactions` scan for them alone is above the 300 GB rebuild budget); NEAR Intents volume (needs
  a partner JWT this build did not have).

## 4. The key classifier

Every sampled transaction is classified by the permission of the key that signed it, as of the
block before the transaction landed (signing time):

1. Tier 1: `view_access_key` now (free public RPC). A key's permission is fixed when it is added, so
   a key that exists now had this permission when it signed, unless it was deleted and re-added in
   between. Re-adds are detected from the nonce (a re-added key's nonce restarts at height x 10^6);
   those go to tier 2.
2. Tier 2: `view_access_key` at the transaction block's `prev_hash` (archival RPC), for keys that are
   gone now or were re-added since.
3. Buckets: `FUNCTION_CALL`; `FULL_ACCESS`; `IMPLICIT_FULL` (a 64-hex implicit account signing with
   the key its name is derived from); `DELEGATED_INNER_FC` and `DELEGATED_INNER_FULL` (NEP-366 meta
   transactions, classified by the inner user signature, never folded into the outer relayer's);
   `UNKNOWN` (neither tier could read the key).
4. The headline FC share counts `FUNCTION_CALL + DELEGATED_INNER_FC`. Both are signatures by a
   function-call key; the relayer controls below move the delegated buckets around.
5. `UNKNOWN` share is reported per week; if it exceeds 5 percent in any scored week, that is stated
   next to the headline.

The full key ledger from `ADD_KEY` and `DELETE_KEY` (sql/01, sql/02) is the census form of the same
rule and is tested against the TypeScript twin on fixtures; it is not run, because its dry run is
roughly 9 GB per day of history, far above the budget.

## 5. Sampling

For each week: 60 block heights drawn uniformly from the week's height range by mulberry32 seeded
with `sha256("keytell-v1|<ISO week>")`; every transaction in those blocks is counted; then 200 of
them are drawn by a PRNG seeded with `sha256("keytell-v1|<ISO week>|txs")` and classified. Shares
carry Wilson 95 percent intervals (these ignore block clustering, so they are a lower bound on the
true width). Block data: FastNEAR's block archive (`mainnet.neardata.xyz`). The sample is a sample:
it is never presented as a census.

## 6. Windows

- In-sample (fit and lag choice): weeks starting 2023-10-16 through 2024-12-23 (63 weeks). The start
  is the first full week in which both USDC contracts emit NEP-141 events in BigQuery: `ft_events`
  holds native USDC from 2022-11-29 and USDC.e only from 2023-10-11.
- Out-of-sample (the backtest): weeks starting 2024-12-30 through the last complete week before the
  registration, 2026-11-02 (97 weeks).
- Forward (the on-chain claim): 12 weeks starting Monday 2026-11-16 00:00 UTC, ending 2027-02-08
  00:00 UTC.
- Weeks before 2023-10-16 are shown in charts with the coverage gap labelled; they are not scored.

## 7. The test

1. Baseline: AR(2) on the outcome, `y_t = a + b1 y_{t-1} + b2 y_{t-2}` (log changes, OLS).
2. Candidate model: the baseline plus `c x_{t-k}` for one candidate X and lag k.
3. Lag choice, in-sample only: for k = 1..8, the lag with the largest in-sample reduction in squared
   error over the baseline (ties to the shorter lag).
4. Out-of-sample: for each out-of-sample week t, refit every model on weeks from 2023-10-16 to t-1
   (expanding window) and forecast y_t. Out-of-sample gain = 1 - SSE(model) / SSE(baseline).
5. Comparison: for the headline against each baseline (DAA, price), the per-week difference in
   squared forecast error, its mean, and a moving-block bootstrap 95 percent interval (block 4 weeks,
   2,000 resamples, seed 20261113).
6. Lagged Spearman correlations, k = 1..8, in-sample and out-of-sample, with the same bootstrap.

## 8. Pass rule (fixed)

The backtest **passes** only if the headline's out-of-sample gain is larger than both DAA's and
price's, **and** both bootstrap intervals of the squared-error difference lie entirely below zero.
Otherwise it fails, and the page headline says: "The data did not support the claim."

The forward claim on chain uses the comparator `LowerBeatsBothShare`: for each forward week the
crank posts the absolute one-step forecast error (millionths of a log change) of the headline
model as `value_e6`, and of the DAA and price models as the baselines, each model at its in-sample
lag and refit on all weeks before the forecast week. A week is a win when the headline's error is
strictly below both. The claim passes if at least 50 percent of posted weeks are wins
(`threshold_e6 = 500000`), with at least 10 of the 12 weeks posted (`min_periods = 10`). By chance
alone one of three similar models beats both others about a third of the time, so 50 percent is a
real bar.

## 9. Controls that could break the claim (each rerun at the headline's in-sample lag)

- Concentration: FC share without the 10 function-call scopes (receiver contracts) with the most
  in-sample FC transactions; and without the 10 most frequent FC signers. If the result vanishes, FC
  activity is a few apps, not broad use.
- Relayers and meta transactions: FUNCTION_CALL only; every delegated transaction counted as FC;
  delegated transactions excluded from both sides.
- Unknown keys: every UNKNOWN counted as FC; every UNKNOWN counted as full access.
- Placebo: the headline log-change series circularly shifted by 1,000 random offsets of at least 8
  weeks (seed 20261114), which keeps its own autocorrelation and breaks its timing. The real
  out-of-sample gain must beat 95 percent of placebos. (Shuffling key kinds within a week, as first
  planned, leaves every weekly share unchanged, so it cannot test anything.)
- Episodes: weeks where one function-call scope carries at least half the week's sampled FC
  transactions, or DAA is at least 3x its trailing 8-week median, are flagged as possible bot or
  farming episodes, shown on the charts, and left out in a rerun. No curated list of airdrop dates is
  used, because none could be sourced for every week.

## 10. Both error directions

On out-of-sample weeks, with the candidate at its in-sample lag: a signal "rose" when its log change
is above its in-sample 67th percentile; the outcome "rose" likewise. Hit: both rose. False alarm:
the signal rose and the outcome did not. Miss: the outcome rose and the signal did not. Counts and
full week lists are published for the headline, DAA and price (the counterfactual "committee with
DAA only").

## 11. Cost

Every BigQuery run is dry-run first, refused above its cap, and logged with bytes billed and the
on-demand price (`data/out/bq_runs.jsonl`). Budget for a full rebuild: under 300 GB.

## 12. Data touched before registration (disclosed)

- In-sample: block samples for weeks from 2022-01-03; BigQuery sql/04 and sql/05 for 2022-01-03 to
  2024-12-29.
- Schema probes (data/probe/): table and column lists; partition date ranges; five `ADD_KEY` rows,
  three `DELETE_KEY` rows, action-kind counts, three transaction rows and four USDC `ft_events` rows,
  all from 2025-01-15; and USDC `ft_events` counts by cause and status for 2025-01-13 to 2025-01-19.
  These read schema and value shapes, not the out-of-sample series; they are listed because they
  touched out-of-sample dates.
- Sampler test weeks 2024-W23 and 2024-W24 (in-sample).

## Deviations

None at registration.
