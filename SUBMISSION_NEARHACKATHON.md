<!-- Generated from docs/SUBMISSION.template.md by scripts/readme.ts. Edit the template. -->
# Submission: NEAR HACKATHON, Investment Thesis track

**Submitted by Kinnoski on 14 Nov 2026, before the deadline.** This is the record of what was sent.
Corrections go through https://nearhackathon.com/request-changes, never a second submission. The contact
email was given on the form and is not stored in this repository.

## Form fields

| Field | Value |
|---|---|
| Project name | Keytell |
| Team lead | Kinnoski (0xkinno) |
| Email | given on the form (personal data, not stored here) |
| Team size | `1` |
| Tracks | `thesis` |
| NEAR mainnet wallet for the prize | `kinnoski.near` |
| Repository link | https://github.com/0xkinno/keytell (public) |
| Demo post link | https://x.com/0xkiddok/status/2121691058698351096 |
| Website (API spam trap) | leave empty |
| Consent | given by Kinnoski |

## What did you build? (20 to 2,000 characters)

```text
Keytell tests one investment thesis about NEAR and publishes the result either way: are transactions signed by function-call keys (the scoped keys apps and agents hold) a better leading indicator of real usage, measured as weekly USDC volume, than daily active accounts or price? Only NEAR has protocol-level function-call keys, and the kind of key behind every signature is public.

The claim, its pass rule and the SHA-256 of the method and every query were written to a keyless NEAR contract with no edit method before any out-of-sample data was read. Registered 2026-11-13, before the first out-of-sample query.

Result: The claim did not hold. Over 94 weeks the test had never seen, adding function-call activity to a baseline forecast of weekly USDC volume made it 5.1% worse; daily active accounts made it 3.6% worse, price 5.5% worse. It needed to beat both. It beat price but not daily active accounts, and neither difference was clear of noise (both bootstrap intervals straddle zero).

What we found instead: signing moved from app-held function-call keys to relayed meta transactions (NEP-366). 1 of 8 control reruns would pass the registered rule: every relayed meta transaction counted as function-call activity. It was registered as a control, not as the claim, so it does not change the verdict; docs/FINDINGS.md treats it as a hypothesis for a new pre-registration.

How: a keyless sampler classifies the key that signed 50,600 mainnet transactions at signing time over public RPC; BigQuery counts DAA and USDC; the app shows every chart's SQL, the case against (controls, 1,000 timing placebos, concentration), a /keys lookup for any account, and a memo the analyst signs with NEP-413. A twelve-week forward claim is open on chain; a crank posts each week with a function-call key limited to post, and anyone can resolve it. make verify rebuilds every number from a clean clone. Ledger on testnet; data from mainnet.
```

## Demo post

Posted by Kinnoski on X with the demo film, tagging @NEARProtocol and #NEARHackathon: https://x.com/0xkiddok/status/2121691058698351096

## At submission

- Repository public: https://github.com/0xkinno/keytell
- Deployed app: https://keytell.vercel.app, frozen through results (18 Nov 2026)
- Demo film linked in the README
- Berthright's README names Keytell, and Keytell's names Berthright (Q-015)
- `make verify` from a clean clone: exit 0
