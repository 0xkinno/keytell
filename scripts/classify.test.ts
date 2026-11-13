// The TypeScript twin of sql/02 on the shared fixtures (scripts/fixtures/keys.json), plus the RPC
// path the sampler uses. Run: npx tsx --test scripts/classify.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import bs58 from "bs58";
import { classify, permissionAt, permissionFromRpc, isDerivedImplicitKey, type KeyEvent, type Permission } from "./lib/classify.ts";

const fx = JSON.parse(readFileSync("scripts/fixtures/keys.json", "utf8"));
const implicitKey = (account: string) => `ed25519:${bs58.encode(Buffer.from(account, "hex"))}`;
const perm = (p?: string): Permission | undefined =>
  p === "FullAccess" ? { kind: "FullAccess" } : p === "FunctionCall" ? { kind: "FunctionCall", receiver_id: "app.near", method_names: [], allowance: null } : undefined;
const events: KeyEvent[] = fx.key_events.map((e: any) => ({ account: e.account, publicKey: e.publicKey, kind: e.kind, permission: perm(e.permission), ts: BigInt(e.ts), idx: e.idx }));

for (const t of fx.transactions) {
  test(`fixture ${t.hash}: ${t.case} -> ${t.expect}`, () => {
    const key = t.publicKey === "DERIVED" ? implicitKey(t.signer) : t.publicKey;
    const permission = permissionAt(events, t.signer, key, BigInt(t.ts));
    const delegate = t.delegate ? { sender: t.delegate.sender, publicKey: t.delegate.publicKey, permission: permissionAt(events, t.delegate.sender, t.delegate.publicKey, BigInt(t.ts)) } : null;
    assert.equal(classify({ signer: t.signer, publicKey: key, permission, delegate }), t.expect);
  });
}

test("implicit account signing with a key that does not derive its name is not IMPLICIT_FULL", () => {
  const acc = "0d3e0b1bfa2bb4bcbaad8ef4ef1a4bfc93dbad04e8b0a0a6cc1fa2a2b2f4f6e3";
  assert.equal(isDerivedImplicitKey(acc, implicitKey(acc)), true);
  assert.equal(isDerivedImplicitKey(acc, "ed25519:AAA"), false);
  assert.equal(classify({ signer: acc, publicKey: "ed25519:AAA", permission: { kind: "FullAccess" } }), "FULL_ACCESS");
});

test("RPC answers map to permissions the way the protocol stores them", () => {
  assert.deepEqual(permissionFromRpc({ permission: "FullAccess", nonce: 1 }), { kind: "FullAccess" });
  assert.deepEqual(permissionFromRpc({ permission: { FunctionCall: { receiver_id: "social.near", method_names: [], allowance: "250000000000000" } } }), { kind: "FunctionCall", receiver_id: "social.near", method_names: [], allowance: "250000000000000" });
  assert.equal(permissionFromRpc({ error: "UNKNOWN_ACCESS_KEY" }).kind, "Missing");
});

test("a delegate action is classified by its inner signer, never by the relayer", () => {
  const out = classify({ signer: "relay.tg", publicKey: "ed25519:RLY", permission: { kind: "FullAccess" }, delegate: { sender: "u.tg", publicKey: "ed25519:U", permission: { kind: "FullAccess" } } });
  assert.equal(out, "DELEGATED_INNER_FULL");
});
