# Submission: NEAR HACKATHON, Investment Thesis track

Draft for Kinnoski. Nothing here is sent until Kinnoski confirms the exact payload. Recheck the live
form before submitting; mistakes go through https://nearhackathon.com/request-changes, never a second
submission. Own cut-off: 14 Nov 2026 21:59 UTC (two hours before the deadline).

## Form fields

| Field | Value |
|---|---|
| Project name | Keytell |
| Team lead | Kinnoski (0xkinno) |
| Email | Kinnoski fills in |
| Team size | `1` |
| Tracks | `thesis` |
| NEAR mainnet wallet for the prize | Kinnoski's own account (never created for them) |
| Repository link | {{repo.url}} (public before submitting) |
| Demo post link | the X post URL, after Kinnoski posts it |
| Website (API spam trap) | leave empty |
| Consent | ticked by Kinnoski |

## What did you build? (20 to 2,000 characters)

```text
Keytell tests one investment thesis about NEAR and publishes the result either way: are transactions signed by function-call keys (the scoped keys apps and agents hold) a better leading indicator of real usage, measured as weekly USDC volume, than daily active accounts or price? Only NEAR has protocol-level function-call keys, and the kind of key behind every signature is public.

The claim, its pass rule and the SHA-256 of the method and every query were written to a keyless NEAR contract (thesis_ledger, zero access keys, no edit method) before any out-of-sample data was read. Registration: {{claim.registered_at}}. First out-of-sample query: {{first_oos_query_at}}.

Verdict: {{backtest.verdict}}. Over {{backtest.oos_weeks_scored}} out-of-sample weeks, the forecast gain from function-call activity over an AR(2) baseline was {{backtest.oos_gain.fc_signed_tx|pct}}, against {{backtest.oos_gain.daa|pct}} for DAA and {{backtest.oos_gain.price|pct}} for price (positive means smaller errors). The rule needed function-call activity to beat both.

What we found instead: signing moved from app-held function-call keys to relayed meta transactions (NEP-366). {{sentences.controls}}

How: a keyless sampler classifies the key that signed {{data.transactions_classified|int}} mainnet transactions at signing time over public RPC; BigQuery counts DAA and USDC; the app shows every chart's SQL, the case against (controls, {{controls.placebo.reps|int}} timing placebos, concentration), a /keys lookup for any account, and a memo the analyst signs with NEP-413. A twelve-week forward claim is open on chain; a crank posts each week with a function-call key limited to post, and anyone can resolve it. make verify rebuilds every number from a clean clone without keys. Ledger on testnet; data from mainnet.
```

## X post (Kinnoski approves and posts)

```text
Built at #NEARHackathon: do NEAR function-call keys lead real usage better than active accounts or price?

Registered on chain before the test. Verdict: {{backtest.verdict}}. Published anyway.

{{app.url}}
{{repo.url}}

@NEARProtocol
```

Attach two screenshots: `docs/screens/hero.png` and `docs/screens/verdict.png`.

## Before submitting

- Repository public (Kinnoski approves), README renders, CI green.
- Deployed app reachable; `live.yml` green.
- Video uploaded and linked in the README.
- Berthright README names Keytell (Q-015), after Kinnoski approves that one line.
