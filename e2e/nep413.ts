// Runs the server's own memo check (app/lib/memo-verify.ts) on real NEP-413 signatures made with real
// NEAR keys, encoded exactly as the browser sends them (app/lib/wallet.ts: base64 signature and nonce).
// The app checks mainnet accounts; this runs the same code against testnet accounts we hold keys for.
// Usage: npx tsx e2e/nep413.ts   (needs ~/.near-credentials/testnet; no mainnet funds)
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { Account, JsonRpcProvider, KeyPair, KeyPairSigner } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
import { verifyAttestation, MEMO_RECIPIENT } from "../app/lib/memo-verify";

const provider = new JsonRpcProvider({ url: "https://rpc.testnet.fastnear.com" });
const cred = (f: string) => ({ account_id: f.replace(/(\.post-key)?\.json$/, ""), ...JSON.parse(readFileSync(`${homedir()}/.near-credentials/testnet/${f}`, "utf8")) });
const b64 = (u: Uint8Array) => Buffer.from(u).toString("base64");
const memoSha = JSON.parse(readFileSync("app/lib/generated/memo.json", "utf8")).sha256;
const message = `Keytell analyst attestation. I have read the evidence against as well as the evidence for in memo sha256 ${memoSha}. The decision is mine. 2026-11-14`;

let pass = 0, total = 0;
const sigFail = (v: any) => !v.ok && /^Signature check failed/.test(v.reason);
const rec = (name: string, ok: boolean, detail: string) => { total++; if (ok) pass++; console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`); };

async function sign(credFile: string, recipient = MEMO_RECIPIENT, msg = message) {
  const c = cred(credFile);
  const account = new Account(c.account_id, provider as never, new KeyPairSigner(KeyPair.fromString(c.private_key)) as never);
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const s: any = await signMessage({ signerAccount: account, payload: { message: msg, recipient, nonce } as never });
  // Encode as the browser does before POSTing to /api/memo-verify.
  // near-api-js 7.5 omits accountId from signMessage; NEAR wallets return it (NEP-413 SignedMessage).
  return { accountId: s.accountId ?? c.account_id, publicKey: s.publicKey.toString(), signature: typeof s.signature === "string" ? s.signature : b64(s.signature), message: msg, nonce: b64(nonce) };
}

const walletSrc = readFileSync("app/lib/wallet.ts", "utf8");
rec("browser and server agree on the recipient", walletSrc.includes(`MEMO_RECIPIENT = "${MEMO_RECIPIENT}"`), MEMO_RECIPIENT);

const good = await sign("keytell.testnet.json");
const v1 = await verifyAttestation(good, provider);
rec("a full-access key's attestation verifies", v1.ok, v1.ok ? `${v1.publicKey} is a full-access key of ${v1.accountId}` : (v1 as any).reason);

const otherAcct = await verifyAttestation({ ...good, accountId: "stranger.keytell.testnet" }, provider);
rec("the same signature claimed for another account is refused", sigFail(otherAcct), (otherAcct as any).reason ?? "accepted");

const tampered = await verifyAttestation({ ...good, message: good.message.replace("2026-11-14", "2026-11-15") }, provider);
rec("an edited message is refused", sigFail(tampered), (tampered as any).reason ?? "accepted");

const wrongRecipient = await verifyAttestation(await sign("keytell.testnet.json", "some-other-app.near"), provider);
rec("a signature made for another recipient is refused", sigFail(wrongRecipient), (wrongRecipient as any).reason ?? "accepted");

const fcKey = await verifyAttestation(await sign("crank.keytell.testnet.post-key.json"), provider);
rec("a function-call key cannot attest (full access required)", sigFail(fcKey), (fcKey as any).reason ?? "accepted");

const notMemo = await verifyAttestation(await sign("keytell.testnet.json", MEMO_RECIPIENT, "I approve everything."), provider);
rec("a signed message that is not an attestation is refused", !notMemo.ok && /not a Keytell memo attestation/.test((notMemo as any).reason), (notMemo as any).reason ?? "accepted");

console.log(`\n${pass} of ${total} NEP-413 checks pass`);
process.exit(pass === total ? 0 : 1);
