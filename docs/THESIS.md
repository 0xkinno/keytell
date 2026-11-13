# Keytell

1. **For** a research analyst who must tell an investment committee whether anyone is really using
   NEAR, or whether it is bots and airdrop farmers.
2. **The claim:** on NEAR, the volume of transactions signed by function-call keys is a better
   leading indicator of real application usage than daily active accounts or token price, because
   apps and agents sign with delegated, scoped keys while speculation and one-off transfers sign
   with full-access keys.
3. **The proof is fixed first:** the claim, its metric, threshold, and the hashes of the method and
   the code are written to a keyless NEAR contract before the test window opens. A crank posts each
   week's measurement with a function-call key; anyone resolves it when the window ends.
4. **Anyone re-runs it:** every number comes from public mainnet data through one command, with no
   account needed, and `make verify` checks the posted hashes against a fresh rebuild.
5. **It can come out against us,** and if it does, the headline says so.

## Name rationale

A tell is the involuntary signal a trader reads across the table. On NEAR the tell is in the key:
which kind of key signed a transaction says whether an app or a person at a keyboard sent it.

Collision check, 13 Nov 2026:

| Where | Result |
|---|---|
| npm `keytell` | not taken (404) |
| GitHub repositories named keytell | two small unrelated personal repositories, no product |
| NEAR mainnet `keytell.near` | does not exist |
| NEAR testnet `keytell.testnet` | free; now ours (created for this build) |
| keytell.com | parked, listed for sale |
| keytell.io, .xyz, .app, .org | do not resolve |
| X handle | could not be checked without signing in |
| Hackathon gallery | no project with this name seen |

No conflict that matters, so Keytell stands. Fallbacks, unused: Latchkey, Small Keys.
