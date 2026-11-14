# REDTEAM_LOG.md

Judge-agent red team on the deployed URL https://keytell.vercel.app and the repository. Each role
used only the live app, the repository and the published rules. Round 1 and round 2 ran on 14 Nov 2026.

## Round 1

| Role | What was tried | Result | Defect | Fix |
|---|---|---|---|---|
| Ten-minute judge | Opened `/memo` in a fresh browser and pressed **Sign as analyst** | **Failed**: "No accounts found" under the button, no wallet offered | `signMemo` asked near-connect for the connected wallet before any wallet was connected, so a first-time visitor could never sign | `lib/wallet.ts` opens the selector and signs in when no wallet is connected; the selector now lists Meteor, Ledger, NEAR Mobile, Ethereum Wallets and NEAR CLI. `e2e/live.mjs` asserts the "Select wallet" dialog with at least two wallets |
| Ten-minute judge | Followed "Try it in two minutes": `/keys` on `aurora`, `relay.tg`, `social.near`, `intents.near`; `/proof` on a phone | Every lookup answered in 1.0 to 1.7 s; `/proof` reached 9 of 9 in 1.6 s on an iPhone 13 profile | `relay.tg` showed an empty key table under the "too many keys" note, and the summary read "20 by relays a meta transaction"; old newest-transaction dates looked like stale data | Empty table hidden; summary reads "20 relayed meta transactions"; a line now says these are transactions the account signed itself, newest first, with the newest date |
| Ten-minute judge | Read `/evidence` brief 1.2 and 1.6 at desktop width | Charts drawn from results | The bar value "-7.7%" ran into the "FC share" label; the 1.6 legend clipped "FUNCTION_CALL only" | Bars keep a gutter for negative values; the series is labelled "Direct FC only" |
| Rubric judge | Mapped technical implementation, design, impact, originality and sustainability to README sections and pages; resolved every link in the README | 14 local links, 1 anchor and 6 app pages resolve; all 19 cited testnet transactions exist, each refusal failed and each control succeeded as the README says | The verdict headline "The data did not support the claim" read as if the data had failed, not the claim | Every page, the README, the memo and the submission lead with "The claim did not hold" and a plain sentence; the registered code's own wording stays in `results.json` |
| Sponsor maintainer (NEAR) | Ran the `near-contract-audit` detector list on `thesis_ledger`: callbacks, reentrancy, JSON integer types, unsaved collection changes, owner checks, yocto attach, storage prefixes, init macro, unbounded loops, randomness, unsafe and float math. Read NEP-330 and a NEP-297 event from chain | No callbacks or cross-contract calls; `U64`/`I64` JSON wrappers; every change written back with `insert`; distinct storage keys; `#[init]` with `PanicOnDefault`; `list_claims` paginated (100 max); periods capped at registration; no floats; `overflow-checks = true`. NEP-330 names commit `20ed43c`, which is on `origin/main` with a byte-identical contract source | `post` has no `assert_one_yocto`: deliberate, because the crank signs with a function-call key, which the protocol forbids from attaching a deposit, and the method is crank-only | none needed; recorded here |
| Sponsor maintainer (NEAR) | Checked the memo signature path end to end with real keys (`e2e/nep413.ts`, the server's own `lib/memo-verify.ts`) | A genuine full-access signature verifies; a signature claimed for another account, an edited message, another recipient, a function-call key and a non-attestation are all refused | near-api-js leaves nonce freshness to the app; an old signature could be replayed as a fresh reading | The server refuses an attestation dated more than two days from today; 8 of 8 checks, including the replay case |
| Verifier | Fresh clone, no keys: `make verify`, then `npx tsx scripts/verify.ts --tamper` | Outputs, memo, FINDINGS, WILD_SET, README and FACTS reproduce byte for byte; 12 of 12 chain checks; `--tamper` exits 1 with 11 of 12 | The local-build hash check is skipped in a clean clone (the wasm is not committed) | none: documented; `fleet/repro-build.sh` rebuilds it, and `/proof` compares the chain hash to the recorded build |
| Skeptic | Hunted numbers typed by hand in the app, README and docs; probed `/api/lookup` with path tricks, markup, overlong and empty ids; looked for claims the app cannot show | README, memo, FINDINGS, EVIDENCE, WILD_SET and the submission are generated from committed outputs and checked by `make verify`; the API refuses every malformed id and normalises case | The "50 percent threshold" on the landing page was typed in the component | It is read from the registered claim (`threshold_e6`) in FACTS |
| Skeptic | Asked whether the one passing control is a forking path | The README, FINDINGS and the app call it a hypothesis picked after the fact, not a result, and the verdict stands | none | none |
| Skeptic | Tried to exhaust the `/keys` rate limit | 60 lookups per IP per day, answers cached 60 s | The counter lives in memory, so each serverless instance keeps its own count: the limit is best-effort | Accepted and stated: a shared counter needs a paid store (asks Kinnoski first under Part 0); the worst case is load on free public RPC, which `/keys` already survives with retries and caching |

## Audit against the build instruction (same day)

Found by walking the plan part by part, fixed before round 2:

| Plan item | Was | Now |
|---|---|---|
| Part 3.4 House of Stake leased names | not built | `scripts/fetch-hos.ts`: 80 names on mainnet, all keyless, none granting a third-party extension; in FACTS, FINDINGS and the README |
| Part 7 wild set | ranked scopes only | `analysis/wild_set.py` and `docs/WILD_SET.md`: top 50 with signers, top signer share and methods; the labelling rule published first; 16 of 50 are run by one operator, carrying 41 percent of sampled function-call transactions. Final labels need a person (Kinnoski) |
| Part 7 cost per observation | not measured | 2.59 Tgas, 0.000237 NEAR, from the crank's control `post` on chain |
| Part 6 `/api/status` NearBlocks probe | missing | probed and reported honestly |
| Part 2 `app/.env.example` | missing | committed, no values |
| Part 1.3 founder stake | not stated | in the README and `docs/THESIS.md` |
| Part 9.5 reduced motion | CSS only | motion animations follow the visitor's setting (`MotionConfig reducedMotion="user"`) |

## Round 2

Run on the redeployed URL after the fixes above.

| Check | Result |
|---|---|
| `e2e/judge.mjs` | 3 of 3 judge steps pass |
| `e2e/live.mjs` (routes, links, `/keys`, memo export, wallet selector, ledger, APIs, refusals) | 24 of 24 pass, including the wallet selector and forged-signature refusals |
| `e2e/layout.mjs` (8 routes × 8 viewports, axe WCAG 2.2 AA) | 64 of 64 views clean |
| `e2e/nep413.ts` (real keys, the server's own check) | 8 of 8 pass, including the replay refusal |
| `make verify` from a clean clone | exit 0; outputs reproduce; 12 of 12 chain checks |
| CI `checks` job on GitHub | failed once on run #7: FACTS hashed the raw `results.json` and `controls.json`, whose last float digits differ between GitHub's CPU and ours (`placebo_p95` ...317427 against ...317871). FACTS and `/proof` now hash a canonical form (numbers to 10 significant digits); a last-digit change passes, a real change fails. The registered analysis code is untouched |

## Open

- Wild-set labels: the mechanical proposal is published; a person gives the final label (Kinnoski).
- NEAR Intents volume: needs a partner token; Kinnoski's 1Click partner token may work.
- The first forward observation lands after 2026-11-23, when the first forward week has ended.
