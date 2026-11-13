# What NEAR gives this build (quoted from the docs)

Read on 13 Nov 2026 from https://docs.near.org (llms.txt index) and https://docs.near-intents.org.

## Access keys (docs.near.org/protocol/accounts-contracts/access-keys)

> "Function Call keys can only sign transactions calling a specific contract, while Full Access keys
> have unrestricted control over the account."

> "`Function-Call` keys can only sign transactions calling a **specific contract**, and do **not
> allow** to **attach NEAR tokens** to the call."

> "`Function Call Keys` are meant to be shared with applications, so third-parties can make contract
> calls in your name."

> "The allowance of an existing key cannot be changed. To get a new allowance, add a new key."

The third quote is the thesis's premise in NEAR's own words: function-call keys are the keys apps
hold. The fourth backs the sampler's first tier: a key's permission does not change after it is
added, so a key that exists now had the same permission when it signed (unless it was deleted and
re-added, which the sampler detects from the nonce). A function-call key is bound to
one `receiver_id`, an optional `method_names` list and an optional gas `allowance`. This is
protocol-level: the key kind of every signature is public state, readable with `view_access_key`
at any block, which is what lets Keytell count signatures by key kind.

## Meta transactions (NEP-366)

A relayer signs and pays for the outer transaction; the user signs the inner `DelegateAction` with
their own key. Keytell classifies these by the inner signature, in their own buckets.

## Implicit accounts

A 64-hex account id is derived from an ed25519 public key; that key signs without ever having been
added by an `AddKey` action. Keytell detects this by decoding the key and comparing it with the name.

## NEP-413 signed messages

A wallet signs `(message, recipient, nonce)` off chain, with no transaction and no fee. Keytell uses it
for the analyst's memo attestation, verified server-side with `near-api-js/nep413` `verifyMessage`
against the account's full-access keys.

## NEP-297 events and NEP-330 metadata

The ledger logs `EVENT_JSON:` events (standard `keytell`) and exposes `contract_source_metadata`
with the build image, commit and source link.

## RPC providers (docs.near.org/api/rpc/providers)

FastNEAR first, near.org as fallback, as in Berthright. Archival access on FastNEAR is marked "Paid
Only"; near.org archival is "Severely rate limited". Both observations shaped the sampler's pacing.

## NEAR Intents (docs.near-intents.org)

The Explorer API needs a partner JWT from partners.near-intents.org and allows one request per five
seconds per partner. Not available to this build, so Intents volume is a stated gap.
