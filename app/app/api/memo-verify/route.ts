import { NextResponse } from "next/server";
import { JsonRpcProvider } from "near-api-js";
import { verifyMessage } from "near-api-js/nep413";
import { RPC } from "@/lib/config";

export const dynamic = "force-dynamic";
const RECIPIENT = "keytell.memo";

// Checks an analyst's NEP-413 memo attestation: the signature over (message, recipient, nonce), and
// that the signing key is a full-access key of the claimed mainnet account (verifyMessage reads it).
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.accountId || !b?.publicKey || !b?.signature || !b?.message || !b?.nonce) return NextResponse.json({ ok: false, reason: "Missing fields." }, { status: 400 });
  if (!/^Keytell analyst attestation\. I have read the evidence against as well as the evidence for in memo sha256 [0-9a-f]{64}\./.test(b.message)) {
    return NextResponse.json({ ok: false, reason: "The signed message is not a Keytell memo attestation." }, { status: 400 });
  }
  try {
    const nonce = Uint8Array.from(Buffer.from(b.nonce, "base64"));
    const signature = Uint8Array.from(Buffer.from(b.signature, "base64"));
    await verifyMessage({ signerAccountId: b.accountId, signerPublicKey: b.publicKey, payload: { message: b.message, recipient: RECIPIENT, nonce } as never, signature, provider: new JsonRpcProvider({ url: RPC.mainnet[0] }) as never });
    return NextResponse.json({ ok: true, accountId: b.accountId, publicKey: b.publicKey });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: `Signature check failed: ${(e as Error).message.slice(0, 160)}` }, { status: 401 });
  }
}
