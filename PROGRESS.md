# Progress: self-judge (Part 13)

Scored 1 to 5 against the build plan's ten questions, on the deployed app at https://keytell.vercel.app,
14 Nov 2026, after two red-team rounds ([REDTEAM_LOG.md](REDTEAM_LOG.md)).

| # | Question | Score | Evidence | Gap |
|---|---|---|---|---|
| 1 | Does a judge understand the person, the question and the verdict in 10 seconds? | 5 | `/` opens on the claim and the Key Wall; directly below, Tolu's question and the verdict plate, "The claim did not hold", with the three gains in plain words. The README opens with the same verdict box under the banner | |
| 2 | Is the claim on chain, dated before the test window, with method and SQL hashes that match the repo? | 5 | `make verify` and `/proof`: claim on chain equals `data/registration.json`; registered before the window; METHOD and CODE_MANIFEST hashes match; 17 registered files unchanged; both out-of-sample queries ran after registration | |
| 3 | Can a skeptic rebuild every headline number from a clean clone, without keys, in 10 minutes? | 5 | Clean clone, `make verify`: exit 0 in under 2 minutes; every output reproduces byte for byte; 12 of 12 chain checks; `--tamper` fails. The CI job reproduces the analysis on GitHub's machines | The census rebuild itself needs a BigQuery project; stated in the README |
| 4 | Is the evidence against as prominent as the evidence for? | 5 | `/against` has six briefs at the same weight as `/evidence`; the README's evidence against carries the placebo, concentration, the operator-run wild set, both error directions and all eight control reruns in a table | |
| 5 | Is every chart's SQL one click away, with bytes scanned and dates? | 4 | Every census chart has "Show the SQL" with bytes, dates and an Open in BigQuery link; the judge run opens one | Sample-based charts link to the sampler code, because no SQL produced them |
| 6 | Does `/keys` work on any account a judge types? | 5 | `e2e/live.mjs` on production: named, relayer, implicit, non-existent and malformed accounts all answer correctly; every README example answers in under 2 s | The per-IP daily limit is per serverless instance (accepted, stated) |
| 7 | Are both error directions and the misses published? | 5 | Hits, false alarms and misses for function-call activity and DAA in `/against` 2.4, the README Measured table and the memo | |
| 8 | Is anything typed by hand that should be generated? | 5 | README, memo, FINDINGS, EVIDENCE, WILD_SET and the submission draft render from committed outputs; `make verify` fails if any is stale. The red team found one typed threshold on the landing page; it now reads FACTS | |
| 9 | Do the README, UI and video say only what the deployed app shows? | 4 | Every README link resolves; all 19 cited testnet transactions exist with the outcome the README states; screenshots come from production at 2x | Video not recorded yet (waiting for Kinnoski's instructions) |
| 10 | Do both READMEs name each other (Q-015)? | 2 | Keytell's README names Berthright in Disclosures | Berthright's README line waits for Kinnoski's approval |

## Plan coverage

| Part | Status |
|---|---|
| 0 Rules | Authorship hooks and workflow; every commit by 0xkinno; house style and name checks in CI; competitors only in `reference/`; nothing spent, posted, submitted or made public without asking |
| 1 Briefing | Track text, judges and form fields in `RULES_EXTRACT.md`; name check in `docs/THESIS.md`; persona labelled; founder stake stated |
| 2 Reuse Berthright | Hooks, checks, facts, verify, repro build, live and crank workflows, app shell and e2e suites adapted, never imported |
| 3 Data | BigQuery census (DAA, transactions, USDC); keyless block sample for the key mix (two-tier key lookup); Coin Metrics price (CoinGecko covers 365 days only); House of Stake side series. Not computable, with reasons: the full key ledger (about 20 TB), retention (154 GB), deploys (481 GB), Intents volume (partner token) |
| 4 Method | Registered on chain before the out-of-sample run; test, controls, both directions, placebo, cost per rebuild |
| 5 Architecture | `sql/00..08`, `analysis/`, `scripts/`, `data/raw`, `data/out`, `contracts/thesis_ledger` (keyless, testnet), `app/`, `docs/`, Makefile targets |
| 6 App | All nine routes live; `/keys` rate-limited and cached; `/proof` 9 of 9 from chain; memo export and NEP-413 signing through the wallet selector |
| 7 Proof plan | Ground truth, controls, wild set (rule published first; all 50 labels approved by Kinnoski), counterfactual, both directions, fault switch, break campaign (16 of 16), cost per rebuild and per observation, surprising finding |
| 8 Phases | 0 to 7 done; 8 done except the video, the X post (Kinnoski posts), the tag and the freeze, which follow submission steps |
| 9 Design | Assay system, hero and Key Wall per 9.3, hand-built charts per 9.4, 64 of 64 views clean, reduced motion respected |
| 10 README | Part 10 structure, every number from FACTS, no first-screen ban words |
| 11 Video, X, submission | X post and form fields drafted in `SUBMISSION_NEARHACKATHON.md`; video next |
| 12 Risk | `docs/RISK.md` covers all six points |
| 13 Self-judge | this file |
