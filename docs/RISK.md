# Data risks

| Risk | What it would do | What the build does |
|---|---|---|
| Survivorship and selection | an outcome chosen after seeing results flatters the claim | the outcome (USDC volume), windows, lags rule and pass rule were registered on chain before any out-of-sample query (docs/METHOD.md) |
| Custodial apps sign with function-call keys for users | FC activity could measure a few large apps, not broad use | concentration control: rerun without the top 10 scopes and top 10 signers; the scope table is published (Brief 2.3) |
| Relayers move signatures between buckets | meta transactions could create or hide FC activity | delegate actions are classified by the inner signer, in their own buckets; three relayer reruns (Brief 2.1) |
| Unread keys | keys deleted since signing and unreadable on archival RPC would bias the share | each unknown is labelled with its reason; reruns with all unknowns as FC and as full access; weekly unknown share published |
| Re-added keys | a key deleted and re-added with a new permission would be read wrongly from current state | detected from the nonce (it restarts at height x 10^6 on re-add) and read on archival RPC instead |
| Sampling error | 200 classified transactions a week give a share with a few points of error | Wilson intervals on every weekly share; the sample's transaction estimate is checked against the census (Brief 1.7) |
| Coverage break in the outcome | bridged USDC.e logged no NEP-141 events before 2023-10-11 | weeks before 2023-10-16 are not scored; the break is stated on the chart and in the memo |
| Data end date | stale data would test the wrong period | BigQuery is current through the census day in FACTS.json; NEAR Lake's deprecation did not end it |
| Third-party price | a wrong price series would distort a baseline | price is a baseline only; source, fetch date and sha256 in data/raw/price.meta.json |
| Crank trust | the contract resolves on numbers the crank posts | every posted number carries the SHA-256 of a committed file; `make verify` recomputes it from public data |
| Rate-limited free endpoints | a rerun could stall | the sampler paces and rotates four public RPCs and is resumable; seeds make the sample identical on rerun |

Nothing here is investment advice. The footer and the memo say so.
