// The server-side check of an analyst's NEP-413 memo attestation, shared by /api/memo-verify and
// e2e/nep413.ts (which runs it against a real testnet account). It checks the message shape, the
// signature over (message, recipient "keytell.memo", nonce), and that the signing key is a
// full-access key of the claimed account at the latest block (verifyMessage reads it over RPC).
import { verifyMessage } from "near-api-js/nep413";

export const MEMO_RECIPIENT = "keytell.memo";
export const ATTESTATION = /^Keytell analyst attestation\. I have read the evidence against as well as the evidence for in memo sha256 [0-9a-f]{64}\./;

export interface AttestationBody { accountId?: string; publicKey?: string; signature?: string; message?: string; nonce?: string }
export type Verdict = { ok: true; accountId: string; publicKey: string } | { ok: false; status: number; reason: string };

export async function verifyAttestation(b: AttestationBody | null, provider: unknown): Promise<Verdict> {
  if (!b?.accountId || !b?.publicKey || !b?.signature || !b?.message || !b?.nonce) return { ok: false, status: 400, reason: "Missing fields." };
  if (!ATTESTATION.test(b.message)) return { ok: false, status: 400, reason: "The signed message is not a Keytell memo attestation." };
  // Freshness: the message ends with the date it was signed; refuse one more than two days away, so an old
  // signature cannot be replayed as a fresh reading (near-api-js leaves nonce freshness to the app).
  const dated = b.message.match(/(\d{4}-\d{2}-\d{2})\s*$/);
  if (!dated) return { ok: false, status: 400, reason: "The attestation must end with the date it was signed." };
  const days = Math.abs(Date.now() - Date.parse(`${dated[1]}T12:00:00Z`)) / 86_400_000;
  if (!(days <= 2)) return { ok: false, status: 400, reason: `The attestation is dated ${dated[1]}; sign a fresh one.` };
  const nonce = Uint8Array.from(Buffer.from(b.nonce, "base64"));
  if (nonce.length !== 32) return { ok: false, status: 400, reason: "The nonce must be 32 bytes." };
  try {
    const signature = Uint8Array.from(Buffer.from(b.signature, "base64"));
    await verifyMessage({ signerAccountId: b.accountId, signerPublicKey: b.publicKey, payload: { message: b.message, recipient: MEMO_RECIPIENT, nonce } as never, signature, provider: provider as never });
    return { ok: true, accountId: b.accountId, publicKey: b.publicKey };
  } catch (e) {
    return { ok: false, status: 401, reason: `Signature check failed: ${(e as Error).message.slice(0, 160)}` };
  }
}
