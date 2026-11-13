# Security

Keytell is a hackathon build. Its contract, `thesis_ledger`, runs on NEAR testnet and holds no
user funds. The data it analyses is public NEAR mainnet history.

## Reporting

Open a private security advisory on this repository, or message @0xkinno on X. Please include the
contract account, the method, and a transaction hash if you have one. We reply within 48 hours
during the judging window (16 to 18 Nov 2026).

## Scope

- `contracts/thesis_ledger` (the pre-registration ledger)
- `scripts/` (sampler, crank, verify) and the app's API routes under `app/app/api`

## What we already guard against

- Nobody can edit a registered claim: there is no edit or upgrade method, and the ledger account
  holds zero access keys after deployment (checked every 6 hours by `.github/workflows/live.yml`).
- The crank's key is a function-call key limited to `post` on the ledger, with a small gas
  allowance. It cannot attach NEAR, register, or resolve.
- Every number the crank posts carries the SHA-256 of the file it came from. `make verify`
  recomputes the file from public data and fails on any mismatch.
- `/api/lookup` reads public RPC data only, is rate-limited per IP, and never asks for a wallet.
