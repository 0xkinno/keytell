<!-- Generated from docs/README.template.md by scripts/readme.ts. Edit the template. -->
<p align="center">
  <img src="app/public/icon.svg" width="76" alt="Keytell mark: a small copper key">
</p>

<h1 align="center">Keytell</h1>

<p align="center">
  <b>On NEAR, do transactions signed by function-call keys show real usage before daily active accounts or price do?</b><br>
  Pre-registered on NEAR before the test data existed. Rebuild every number with one command.
</p>

<p align="center">
  <a href="https://keytell.vercel.app"><b>Live app</b></a> &nbsp;·&nbsp;
  <a href="https://keytell.vercel.app/evidence"><b>Evidence</b></a> &nbsp;·&nbsp;
  <a href="https://keytell.vercel.app/against"><b>Against</b></a> &nbsp;·&nbsp;
  <a href="https://keytell.vercel.app/ledger"><b>Ledger</b></a> &nbsp;·&nbsp;
  <a href="https://keytell.vercel.app/proof"><b>Proof from chain</b></a> &nbsp;·&nbsp;
  Video: linked at submission
</p>

<p align="center">
  <a href="https://github.com/0xkinno/keytell/actions/workflows/ci.yml"><img src="https://github.com/0xkinno/keytell/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <a href="https://github.com/0xkinno/keytell/actions/workflows/live.yml"><img src="https://github.com/0xkinno/keytell/actions/workflows/live.yml/badge.svg" alt="Live checks"></a>
  <img src="https://img.shields.io/badge/licence-MIT-9a5212" alt="MIT">
</p>

<p align="center"><img src="docs/screens/hero.png" alt="The Keytell landing page: the headline Count the small keys, not the accounts, beside the Key Wall, one key per week since January 2022, each filled by the share of NEAR mainnet transactions signed by a function-call key that week" width="100%"></p>

> **The claim did not hold.** Out of sample, function-call keys did not forecast weekly USDC volume better than daily active accounts or price. The data is complete and the test ran exactly as registered; the thesis failed it, and Keytell publishes that.
>
> Over 94 weeks the test had never seen, adding function-call activity to a baseline forecast of weekly USDC volume made it **5.1% worse**. Daily active accounts made it 3.6% worse, price 5.5% worse. The rule, written on chain first, needed function-call activity to beat both. It beat price but not daily active accounts, and neither difference was clear of noise (both bootstrap intervals straddle zero). A twelve-week forward test of the same claim is open on chain now and resolves without us.

## At a glance

| | |
|---|---|
| **Who it is for** | A research analyst who has to tell an investment committee whether NEAR usage is real or bots and airdrop farmers |
| **What it does** | Reads which kind of key signed each sampled mainnet transaction, tests whether function-call-signed activity forecasts USDC volume better than daily active accounts or price, publishes the case against with the same weight, and exports a memo the analyst signs |
| **Why NEAR** | Only NEAR has protocol-level function-call keys: a key bound to one contract that cannot move NEAR. Which kind of key signed is public state, for every transaction, at every block |
| **Verdict from chain** | Backtest: **The claim did not hold** over 94 out-of-sample weeks. Forward claim `keytell-fc-leads-usdc-1`: **Open**, 12 weeks from 2026-11-16 |
| **Headline result** | Against DAA, mean squared-error difference 0.006578 (95% interval -0.055139 to 0.069399); against price -0.001606 (-0.060525 to 0.05815). Passing needed both intervals below zero |
| **What we found instead** | Signing moved from app-held function-call keys to relayed meta transactions: 22.5% of transactions were signed directly by a function-call key in 2022, 1.6% in 2025, while relayed meta transactions rose to 73.5% |
| **Track** | Investment Thesis (`thesis`) |
| **Built with** | near-sdk 5.29 · near-workspaces · cargo-near reproducible build · NEP-297 · NEP-330 · NEP-366 · NEP-413 · near-connect · BigQuery `crypto_near_mainnet_us` · FastNEAR · Next.js 16 · d3 |

### See it on chain

| What happens | Transaction |
|---|---|
| The claim, its pass rule and the SHA-256 of the method and every query are written to the ledger, before any out-of-sample query | [registered](https://testnet.nearblocks.io/txns/FpHj8UhHEyVQBWhafiY4pQH3UzQpPf2wKXvDFVhTYZQo) at 2026-11-13T18:17:43.113Z; first out-of-sample query 2026-11-13T18:18:03+00:00 |
| The ledger is deployed and initialised in one transaction | [deployed](https://testnet.nearblocks.io/txns/3QVVUPwsFNtstbinBre7H6T2B4tTqim2v2AB4LMC4FKR) |
| Its only key is deleted: nobody can upgrade it or edit a claim, including us | [sealed](https://testnet.nearblocks.io/txns/CaKuchaw3kXmFqJAbw5v9c9XMEyUfnmpv9AFH4UtzQP4); access keys now **0** |
| The crank receives a function-call key that can call `post` and nothing else | [key added](https://testnet.nearblocks.io/txns/3Wg1AM9h41obf3UoXdRGQzBjPxUGDJ1Ndm5ghVRyBjmv) |
| A threshold edit is attempted on a twin ledger: no such method exists | [refused, `MethodNotFound`](https://testnet.nearblocks.io/txns/4BLPGJT7BFcyzw2xVHPoHb3xWpzRRNkVh4ri57TcZnvX) |
| Resolve | opens when the forward window ends; [/ledger](https://keytell.vercel.app/ledger) counts down, and anyone may call it |

All 16 attempts of the break campaign are listed under [What it will not do](#what-it-will-not-do).

---

## Monday 07:40

Tolu Adeyemi, a research analyst at a crypto fund in Lagos, has twenty minutes before the investment committee. The partner asks: *"Is anyone actually using NEAR, or is it bots and airdrop farmers?"* Every dashboard Tolu can open shows daily active accounts and price. Both are cheap to fake: one script makes a thousand accounts, one post moves price. Today Tolu screenshots a DAA chart, says "activity is up", and the committee sizes the position on conviction.

| What is true | Source |
|---|---|
| NEAR records which kind of key signed every transaction | [docs.near.org, access keys](https://docs.near.org/protocol/accounts-contracts/access-keys) |
| "`Function Call Keys` are meant to be shared with applications" | same page |
| Function-call keys "do not allow to attach NEAR tokens to the call" | same page |

**The insight.** A thousand fake accounts cost a script. A function-call key costs an app: it is issued by an account to one contract, and it only exists because someone built something that a user let act for them. If usage is real, those small keys should move before account counts and price do. Keytell turns that hunch into a claim that can fail, fixes it on chain before the data, and lets the data answer.

With Keytell, Tolu opens one page: the claim as it was written before the test, the evidence for, the evidence against, the SQL behind every chart, a lookup that classifies any account, and a memo to sign. Keytell never says buy. The NEP-413 signature on the memo is Tolu's attestation that the evidence against was read. *Tolu is an illustrative analyst; the data, the chain and the verdict are real.*

**Our stake, stated plainly.** The builder, Kinnoski, ships on NEAR: Berthright's crank signs with function-call keys, the very signal this thesis counts. We wanted the claim to hold. Writing it to chain before the data is what kept that wish out of the result.

---

## The claim

> On NEAR, the volume of transactions signed by function-call keys is a better leading indicator of real application usage than daily active accounts or token price.

Registered at 2026-11-13T18:17:43.113Z in `ledger.keytell.testnet` ([transaction](https://testnet.nearblocks.io/txns/FpHj8UhHEyVQBWhafiY4pQH3UzQpPf2wKXvDFVhTYZQo)). Method hash `90f687b9d36d7ef6...` ([docs/METHOD.md](docs/METHOD.md)); code manifest hash `47e2d8be113495fc...` ([docs/CODE_MANIFEST.sha256](docs/CODE_MANIFEST.sha256), seventeen SQL, sampler and analysis files); data commit `e27a50818aa1c2e9`. Both hashes still match the repository: method yes, manifest yes. `make verify` and [/proof](https://keytell.vercel.app/proof) check this against the chain every time they run.

**The pass rule, as registered:** each signal enters an AR(2) forecast of weekly USDC volume at the lag (1 to 8 weeks) chosen on in-sample weeks only (2023-10-16 to 2024-12-23); expanding-window one-step forecasts are scored out of sample (2024-12-30 to 2026-11-02). The claim passes only if function-call-signed activity has a larger out-of-sample gain than both DAA and price **and** both moving-block bootstrap intervals of the error difference sit below zero.

## The evidence for

- The claim did not hold: over 94 out-of-sample weeks of one-step forecasts of weekly USDC volume, adding function-call-signed activity to an AR(2) baseline added 5.1 percent to forecast error; daily active accounts added 3.6 percent to forecast error; price added 5.5 percent to forecast error. The pass rule needs function-call activity to do better than both.
- In 2026-W45, 29.5 percent of sampled mainnet transactions were signed by a function-call key (95 percent interval 23.6 percent to 36.2 percent); 35.5 percent were meta transactions relayed for a user.
- The sample's weekly transaction estimate lands within 7.8 percent of the BigQuery census in the median week.
- Best in-sample lags: function-call-signed 4 weeks, DAA 4, price 3. Only transaction count lowered the out-of-sample error at all (+1.8%).

## The evidence against

We lead with it as hard as with the case for.

- The real out-of-sample gain (-5.1 percent) beats 9 percent of 1000 timing placebos; the bar is 95 percent.
- The ten contracts that function-call keys were most often scoped to carry 91.4 percent of all sampled function-call transactions.
- 16 of the 50 contracts that function-call keys were most often scoped to are run by one operator account, carrying 41.0 percent of all sampled function-call transactions; `token.sweat` alone shows 1419 sampled transactions from a single signer. Much of what looks like app-held keys is an app's back office signing for itself (docs/WILD_SET.md).
- Function-call keys flagged 28 weeks: 13 hits and 15 false alarms, with 24 misses. DAA: 2 hits, 7 false alarms, 35 misses.
- 1 of 8 control reruns would pass the registered rule: every relayed meta transaction counted as function-call activity. It was registered as a control, not as the claim, so it does not change the verdict; docs/FINDINGS.md treats it as a hypothesis for a new pre-registration.
- Largest weekly share of keys nobody could read: 1.5%. Weeks above 5 percent in the scored window: none.

| Control rerun (registered before the test) | Function-call gain | DAA gain | Price gain | Weeks | Pass rule |
|---|---|---|---|---|---|
| Ten largest function-call scopes removed | -13.1% | -3.9% | -8.6% | 46 | fails |
| Ten busiest signers removed | -1.5% | -4.0% | -6.7% | 86 | fails |
| Meta transactions dropped from function-call activity | -4.7% | -4.1% | -7.0% | 84 | fails |
| Every relayed meta transaction counted as function-call | +0.1% | -3.5% | -7.2% | 97 | **passes** |
| Meta transactions removed from both sides | -2.4% | -4.1% | -7.0% | 84 | fails |
| Every unknown key counted as function-call | -5.3% | -3.6% | -5.5% | 94 | fails |
| Every unknown key counted as full access | -5.1% | -3.6% | -5.5% | 94 | fails |
| Flagged bot or farming weeks left out | -2.8% | -1.9% | -8.5% | 43 | fails |

## What we found instead

<p align="center"><img src="docs/screens/keymix.png" alt="Stacked weekly chart of the key that signed sampled NEAR transactions from 2022 to 2026: the copper function-call layer shrinks after 2023 while the hatched layer of relayed meta transactions grows to most of the chain" width="100%"></p>

| Year | Weeks sampled | Transactions classified | Function-call key | Relayed meta transaction | Implicit account | Full-access key |
|---|---|---|---|---|---|---|
| 2022 | 52 | 10,400 | 22.5% | 0.0% | 9.2% | 68.2% |
| 2023 | 52 | 10,400 | 19.1% | 0.4% | 21.2% | 59.2% |
| 2024 | 53 | 10,600 | 3.4% | 45.8% | 5.3% | 45.6% |
| 2025 | 52 | 10,400 | 1.6% | 73.5% | 1.0% | 23.9% |
| 2026 | 44 | 8,800 | 6.4% | 54.4% | 2.7% | 36.5% |

The classic pattern, where an app holds a scoped key for its user and signs on its own, faded. NEP-366 meta transactions took its place: a relayer pays the gas and the user's key signs the inner action. The function-call scopes that remain are concentrated: `app.nearcrowd.near` alone carries 40.8% of sampled function-call transactions. The one control that would pass counts relayed transactions as function-call activity. It was picked after the fact, so it is a hypothesis for the next pre-registration, not a result. Query and tables: [docs/FINDINGS.md](docs/FINDINGS.md).

## What would change this conclusion

- The forward claim succeeding on chain: at least half of the 12 forward weeks won. That is new evidence, not a rerun of old weeks.
- A new claim, registered before its data, that holds out of sample. A control picked after the fact does not count.
- The USDC census proving wrong or incomplete in a way that changes the out-of-sample errors.

---

## How it works

<table>
<tr>
<td width="50%"><b>1 · Read the key behind each signature.</b><br>Sixty seeded random blocks a week from the FastNEAR archive, then two hundred seeded random transactions. Each signing key is read with <code>view_access_key</code>, now or at the block before signing, and classified: function-call, full access, implicit account, or a relayed meta transaction's inner signer.</td>
<td width="50%"><b>2 · Count the chain in full.</b><br>BigQuery's public NEAR dataset gives weekly transactions, daily active accounts and USDC transfer volume. Every query carries its purpose, tables, dates and dry-run bytes, and refuses to run above a scan cap.</td>
</tr>
<tr>
<td><b>3 · Fix the test before the data.</b><br>The method, the comparator and the hash of every query and analysis file go to <code>thesis_ledger</code>, a keyless contract with no edit method. Only then do the out-of-sample queries run.</td>
<td><b>4 · Publish both sides, and keep watching.</b><br>The registered test and every control write <code>FACTS.json</code>; the app, this README and the memo read only from it. A crank posts each forward week with a key that can call <code>post</code> and nothing else.</td>
</tr>
</table>

```mermaid
flowchart LR
  A["FastNEAR block archive<br/>60 blocks a week"] --> S["sampler<br/>key at signing time"]
  R["public RPC<br/>view_access_key"] --> S
  B["BigQuery<br/>transactions, ft_events"] --> C["census<br/>DAA, tx, USDC"]
  P["Coin Metrics<br/>price"] --> W
  S --> W["weekly series"]
  C --> W
  W --> M["pre-registered test<br/>and controls"]
  M --> F["FACTS.json"]
  F --> APP["app, README, memo"]
  L["thesis_ledger on NEAR<br/>claim and hashes"] --> APP
  K["crank<br/>post-only key"] --> L
```

```mermaid
sequenceDiagram
  participant K as Keytell
  participant L as thesis_ledger
  participant Q as BigQuery
  participant C as crank (post-only key)
  participant A as anyone
  K->>L: register(claim, threshold, method and code hashes)
  Note over L: zero access keys, no edit method
  K->>Q: out-of-sample queries, only after registration
  loop every forward week
    C->>L: post(period, observation, hash of its source file)
  end
  A->>L: resolve(claim) after the window ends
  L-->>A: Passed or Failed, from posted weeks only
```

## Why only NEAR

- **Access key types.** A function-call key is bound to one receiver, optional methods and a gas allowance, and cannot attach NEAR. Apps hold these keys for users. Every signature's key kind is public and can be read at any block, which is what makes the signal hard to fake.
- **Meta transactions.** NEP-366 delegate actions separate the relayer's signature from the user's. Keytell counts the user's inner signature, so a relayer carrying thousands of users does not read as one account.
- **Implicit accounts.** A 64-hex account signs with the key its name derives from; Keytell recognises it instead of guessing.
- **Names, not hashes.** `relay.tg`, `aurora` and `intents.near` are readable accounts, so the concentration brief can say which apps carry the signal, and `/keys` can classify any of them. House of Stake has leased 80 top-level names on mainnet (2026-09-18 to 2026-11-13); 80 of them hold no access key at all, and 0 grant an extension to anyone beyond their holder and House of Stake's default. Delegated signing has not reached them yet.

---

## What it will not do

Each attempt below is a real testnet transaction against a twin ledger running the same code hash as the real one; the contract's 21 unit tests, a 10,000-case property test and two sandbox tests pin the same rules.

| Attempt | Signer | Result, as designed | Transaction |
|---|---|---|---|
| A stranger registers a claim | `stranger.keytell.testnet` | refused, `E_NOT_PUBLISHER` | [HR39qKmSYT...](https://testnet.nearblocks.io/txns/HR39qKmSYThq8hh9FyX2bLmqkw844oLxcPbVcAoqyWTd) |
| The publisher registers after the window opened | `keytell.testnet` | refused, `E_WINDOW_STARTED` | [A2saGV3CjM...](https://testnet.nearblocks.io/txns/A2saGV3CjMaztgidosCpcLr5ZJmbT7JnGCcx6YrKemoD) |
| The publisher registers a valid claim (control) | `keytell.testnet` | accepted (control) | [EE1txMBD8d...](https://testnet.nearblocks.io/txns/EE1txMBD8dmW9ZeFGrCKkA9HdVkAE3dPWsSjx8wjU5R4) |
| The publisher registers the same id again | `keytell.testnet` | refused, `E_CLAIM_EXISTS` | [Exw6RVDAaB...](https://testnet.nearblocks.io/txns/Exw6RVDAaBqZVFRjF1WZaS8N1WNtkRAJoDv9CTC6RQvo) |
| The publisher tries to edit the threshold | `keytell.testnet` | refused, `MethodNotFound` | [4BLPGJT7BF...](https://testnet.nearblocks.io/txns/4BLPGJT7BFcyzw2xVHPoHb3xWpzRRNkVh4ri57TcZnvX) |
| Anyone resolves before the window ends | `stranger.keytell.testnet` | refused, `E_WINDOW_OPEN` | [AN12BPNiaM...](https://testnet.nearblocks.io/txns/AN12BPNiaM67jPxnDzgbcXnNKDyYLhdy4xVxxh6cECj) |
| A stranger posts an observation | `stranger.keytell.testnet` | refused, `E_NOT_CRANK` | [N2Axv82SaR...](https://testnet.nearblocks.io/txns/N2Axv82SaRmUG5ZWKHrqJEeheRUo8DkMwVdEYLBW5n2) |
| The crank posts before the period has ended | `crank.keytell.testnet` | refused, `E_PERIOD_NOT_ENDED` | [HmsUfkZBEv...](https://testnet.nearblocks.io/txns/HmsUfkZBEve7VR9AoebccwaGBJyp4DjDZhppkUDoiwx2) |
| The crank posts period 1 (control) | `crank.keytell.testnet` | accepted (control) | [6ZYP8Y1k94...](https://testnet.nearblocks.io/txns/6ZYP8Y1k94ACM9XyEGXMKpuGpwSaD2ua5S2J7DiALVo) |
| The crank backdates a post to period 0 | `crank.keytell.testnet` | refused, `E_BACKDATE` | [3XgJxHAorK...](https://testnet.nearblocks.io/txns/3XgJxHAorKCQR1r5zY5ju5FVXJoeDQ6DxRkz25uZj4CK) |
| The crank posts period 1 twice | `crank.keytell.testnet` | refused, `E_ALREADY_POSTED` | [DY5PFunssp...](https://testnet.nearblocks.io/txns/DY5PFunsspB1NhaHcmZcERBsWqTE4fWWq23RKXJZofNR) |
| The crank posts past the window | `crank.keytell.testnet` | refused, `E_OUT_OF_WINDOW` | [HM8tttT6fJ...](https://testnet.nearblocks.io/txns/HM8tttT6fJx2vDBjeb4HHmMzEP4KWdtgaCrz6hYXRw9e) |
| Anyone resolves after the window (control) | `stranger.keytell.testnet` | accepted (control) | [AtUerHVSLA...](https://testnet.nearblocks.io/txns/AtUerHVSLAQL7JeaLFaBStW3iNFrnkrznvji9oi2nR9C) |
| The crank posts after resolution | `crank.keytell.testnet` | refused, `E_RESOLVED` | [6EEAnyEBLc...](https://testnet.nearblocks.io/txns/6EEAnyEBLceXmiHWjBeXZEGgLiDyXT5pVCD43ePpLNw8) |
| Anyone resolves a second time | `stranger.keytell.testnet` | refused, `E_RESOLVED` | [3QcSTd4k65...](https://testnet.nearblocks.io/txns/3QcSTd4k652BqNQACZaurxjqytpdH5UVX9Fc4Lg8zaAF) |
| The crank's post-only key calls resolve on the real ledger | `crank.keytell.testnet` | refused, `MethodNameMismatch` | none: the protocol refused it before a transaction existed |

## Who holds which key

| Account | Keys | Can | Cannot |
|---|---|---|---|
| `ledger.keytell.testnet` | **0** (deleted after init) | run its own rules | be upgraded, edited or drained by anyone, including us |
| `crank.keytell.testnet` | one function-call key, `post` only, 0.25 NEAR gas allowance | post one forward week, once, after it ends | register, resolve early, backdate, or touch a claim's terms |
| `keytell.testnet` | full access | register a new claim before its window opens | change a registered claim (no such method exists) |
| the app's server | **none** | read public RPC and BigQuery outputs | sign anything for anyone |
| an analyst's wallet | their own | sign the memo attestation (NEP-413, no transaction, no fee) | nothing on Keytell's contracts |

---

## Measured

Out-of-sample gain is 1 minus the model's squared forecast error over the AR(2) baseline's: positive means smaller errors, negative means adding the signal made forecasts worse.

| Measure | Value | Source |
|---|---|---|
| Out-of-sample gain, function-call-signed | -5.1% | data/out/results.json |
| Out-of-sample gain, DAA | -3.6% | same |
| Out-of-sample gain, price | -5.5% | same |
| Out-of-sample gain, function-call share | -7.7% | same |
| Out-of-sample gain, transaction count | +1.8% | same |
| Hits, false alarms, misses (function-call) | 13, 15, 24 | data/out/directions.csv |
| Hits, false alarms, misses (DAA) | 2, 7, 35 | same |
| Timing placebos beaten | 9% of 1000 (the bar is 95%) | data/out/placebo.csv |
| Weeks flagged as possible bots or farming | 167 | data/out/episodes.csv |
| Weeks sampled | 253 (2022-W01 to 2026-W45) | data/raw/sample |
| Blocks sampled, transactions classified | 15,180, 50,600 | same |
| Keys read at the block before signing (archival) | 12,752 | same |
| Sample against census, median week | within 7.8% | data/out/weekly.csv |
| Census through | 2026-11-08 | data/out/bq_runs.jsonl |
| Cost per census rebuild | 179.7 GB, about $1.02 at the on-demand price (inside the free monthly terabyte) | same |
| Cost per forward observation | 2.59 Tgas, 0.000237 NEAR; the whole twelve-week claim about 0.00284 NEAR | [measured](https://testnet.nearblocks.io/txns/6ZYP8Y1k94ACM9XyEGXMKpuGpwSaD2ua5S2J7DiALVo) |
| Live app, end to end | 24 of 24 checks on https://keytell.vercel.app, including the wallet selector and forged-signature refusals | e2e/live-report.json |
| Layout and accessibility | 64 of 64 views clean (8 routes × 8 viewports): no horizontal scroll, no overlap, tap targets of 44 px, axe WCAG 2.2 AA, no console errors | e2e/layout-report.json |

## Try it in two minutes

1. Open **[/keys](https://keytell.vercel.app/keys)** and type `aurora` or `relay.tg`. See its keys marked function-call or full access, and its recent transactions classified by the key that signed them. No wallet.
2. Open **[/proof](https://keytell.vercel.app/proof)**. Every check runs in your browser against NEAR testnet and against files your browser hashes itself.
3. From a clean clone, with no keys:

```bash
git clone https://github.com/0xkinno/keytell && cd keytell && make setup && make verify
```

<table>
<tr>
<td><img src="docs/screens/evidence.png" alt="Brief 1.2: horizontal bars of out-of-sample forecast gain by signal, function-call activity at minus 5.1 percent, DAA minus 3.6, price minus 5.5, transaction count plus 1.8"></td>
<td><img src="docs/screens/against.png" alt="Brief 2.2: histogram of 1,000 timing placebos with the real gain marked well inside the distribution, left of the 95th percentile line"></td>
</tr>
<tr>
<td><img src="docs/screens/keys.png" alt="The /keys lookup on relay.tg: a relayer with more keys than RPC lists, and its recent transactions each tagged as a relayed meta transaction"></td>
<td><img src="docs/screens/proof.png" alt="Proof from chain: 9 of 9 checks pass, run in the browser, starting with zero access keys on the ledger and the reproducible build hash"></td>
</tr>
</table>

## Judging criteria map

| Criterion | Where to look |
|---|---|
| **Technical implementation** | a keyless sampler that classifies keys at signing time on archival RPC; census SQL tested against the TypeScript classifier on fixtures in BigQuery; `thesis_ledger` with 21 unit tests, a 10,000-case property test, two sandbox tests and a 16-attempt break campaign; a reproducible build whose hash matches chain; `make verify` with a tamper check |
| **Design** | the Assay system ([docs/DESIGN.md](docs/DESIGN.md)); the Key Wall is the data; every brief answers one question in one generated sentence |
| **Impact** | an analyst's real question answered with a claim that could not be tuned, the case against at full weight, and a memo the analyst signs |
| **Originality** | a NEAR-only signal (the key kind behind each signature), pre-registered on NEAR, observed on chain by the very kind of key it counts; a falsified thesis published as the headline |
| **Sustainability** | a weekly crank and six-hourly live checks; every number rebuilds from public data; the forward claim resolves without us |

## Live, substituted, designed

| Piece | State |
|---|---|
| Ledger, claim, crank key, proof checks | **live** on NEAR testnet, keyless; code hash equals the reproducible build |
| The data | **live** NEAR mainnet: FastNEAR block archive, public RPC (current and archival), BigQuery public dataset |
| `/keys` | **live** mainnet RPC; recent transactions from FastNEAR's transaction API, because NearBlocks rate-limited this build |
| Price | Coin Metrics Community API, because CoinGecko's public API covers 365 days only |
| Memo signature | **live** NEP-413 through near-connect on mainnet wallets; the server checks the signature and that the key is a full-access key of the account |
| Degraded states | designed and labelled: `KEYTELL_FAULT=stale_bq`, `intents_down`, `rpc_down` |

## Limits

- The key mix is a sample: 50,600 transactions over 253 weeks, with intervals. The full ADD_KEY ledger would scan about 20 TB.
- USDC volume before 2023-10-16 is not in the census (USDC.e logged no NEP-141 events until 2023-10-11), so earlier weeks are shown, not scored.
- The contract resolves on the observations the crank posts. Trust in those numbers comes from `make verify`, which recomputes each from public data and compares hashes, not from the contract.
- Retention and NEAR Intents volume are not computed: the first is above the scan budget, the second needs a partner key this build did not have.
- The ledger runs on testnet; the data is mainnet.

## Disclosures

Built with an AI coding agent under the author's direction. Libraries: near-sdk, near-workspaces, near-api-js, @hot-labs/near-connect, Next.js, React, Tailwind, motion, lenis, d3, lucide-react, proptest, numpy, pandas, scipy, statsmodels. Data: BigQuery public dataset terms; Coin Metrics Community Data (attribution); FastNEAR public endpoints; CoinGecko was evaluated and not used. Tolu Adeyemi is an illustrative persona. Nothing here is investment advice. **Other project by the same builder in this hackathon: Berthright (NFTs That Do Something), github.com/0xkinno/berthright.** The two are independent.

## Run it

```bash
make setup && make verify
```

```bash
make test
```

```bash
make sample FROM=2025-01-06 TO=2025-01-06
```

```bash
cd app && npm ci && npx next dev
```

Testnet accounts, code hashes and transactions: `deployments/testnet.json`. The deployed app: `deployments/app.json`.

## Repository map

```
contracts/thesis_ledger   the pre-registration ledger (Rust, near-sdk 5.29): unit, property and sandbox tests
scripts/                  sampler, classifier, facts, verify, register, crank, break campaign, README renderer
sql/                      census queries, each with purpose, tables, dates and dry-run bytes in its header
analysis/                 weekly series, the registered test, controls, findings, memo
data/                     committed inputs and outputs, registration, break campaign
app/                      the Next.js site and its API routes
e2e/                      judge run, live suite, layout and accessibility, NEP-413 check, screenshots
docs/                     METHOD, FACTS, FINDINGS, EVIDENCE, THESIS, MOMENT, RISK, DESIGN, SDK_SURFACE, PROOF_PLAN
```

MIT licence · [METHOD](docs/METHOD.md) · [FINDINGS](docs/FINDINGS.md) · [EVIDENCE](docs/EVIDENCE.md) · [RISK](docs/RISK.md) · [PROGRESS](PROGRESS.md)
