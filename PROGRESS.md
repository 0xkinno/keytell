# Progress: self-judge (Part 13)

Scored 1 to 5 against the build plan's ten questions, with the evidence for each score. Rescored
after deployment; items that need the deployed URL are marked.

| # | Question | Score | Evidence | Gap |
|---|---|---|---|---|
| 1 | Does a judge understand the person, the question and the verdict in 10 seconds? | 4 | `/` opens on the claim and the Key Wall; the verdict plate (oxide when failed) and three numbers from FACTS sit directly below Tolu's question | Rescore on the deployed URL at phone width |
| 2 | Is the claim on chain, dated before the test window, with method and SQL hashes that match the repo? | 5 | `make verify`: claim on chain equals `data/registration.json`; registered before the window; METHOD and CODE_MANIFEST hashes match; 17 registered files unchanged; both out-of-sample queries ran after registration (`e2e/verify.log`) | |
| 3 | Can a skeptic rebuild every headline number from a clean clone, without keys, in 10 minutes? | 5 | Clean clone, `make verify`: exit 0 in under 2 minutes, outputs reproduce byte for byte, 12 of 12 chain checks (`docs/EVIDENCE.md`) | The census rebuild itself needs a BigQuery project; stated in the README |
| 4 | Is the evidence against as prominent as the evidence for? | 5 | `/against` has six briefs at the same weight as `/evidence`; the README leads with the verdict, which is a failure; the memo, README and submission say so first | |
| 5 | Is every chart's SQL one click away, with bytes scanned and dates? | 4 | Every census chart has "Show the SQL", bytes and dates; judge e2e opens one | Sample-based charts link to the sampler code, not SQL, because no SQL produced them |
| 6 | Does `/keys` work on any account a judge types? | 4 | Judge e2e passes locally; handles implicit accounts, too many keys, relayers; rate limit 60 per day per IP | Rescore on the deployed URL |
| 7 | Are both error directions and the misses published? | 5 | Hits, false alarms and misses for function-call activity and DAA in `/against` 2.4, the README Measured table and the memo | |
| 8 | Is anything typed by hand that should be generated? | 5 | README, memo, FINDINGS, EVIDENCE and the submission draft are rendered from committed outputs; `make verify` fails if any is stale; it caught one stale sentence during this build | |
| 9 | Do the README, UI and video say only what the deployed app shows? | n/a | Needs the deployed URL; video not recorded yet | Record after deploy |
| 10 | Do both READMEs name each other (Q-015)? | 2 | Keytell's README names Berthright | Berthright's README line waits for Kinnoski's approval |
