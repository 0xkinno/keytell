// The key classifier. A transaction is bucketed by the permission of the key that signed it, read
// from chain state as of the block before the transaction landed (signing time). This file is the
// TypeScript twin of sql/02_tx_classified.sql; scripts/classify.test.ts runs both on the same
// fixtures (the SQL side only when BigQuery credentials exist).
import bs58 from "bs58";

export type Bucket =
  | "FUNCTION_CALL"
  | "FULL_ACCESS"
  | "IMPLICIT_FULL"
  | "DELEGATED_INNER_FC"
  | "DELEGATED_INNER_FULL"
  | "UNKNOWN";

export const BUCKETS: Bucket[] = ["FUNCTION_CALL", "FULL_ACCESS", "IMPLICIT_FULL", "DELEGATED_INNER_FC", "DELEGATED_INNER_FULL", "UNKNOWN"];

/** What the chain said about one key: FullAccess, FunctionCall (with its scope), or nothing found. */
export type Permission =
  | { kind: "FullAccess" }
  | { kind: "FunctionCall"; receiver_id: string; method_names: string[]; allowance: string | null }
  | { kind: "Missing"; reason: string };

/** Turns an RPC view_access_key result (or its error) into a Permission. */
export function permissionFromRpc(r: any): Permission {
  if (!r || r.error) return { kind: "Missing", reason: String(r?.error ?? "no answer") };
  const p = r.permission;
  if (p === "FullAccess") return { kind: "FullAccess" };
  if (p && typeof p === "object" && p.FunctionCall) {
    const fc = p.FunctionCall;
    return { kind: "FunctionCall", receiver_id: fc.receiver_id, method_names: fc.method_names ?? [], allowance: fc.allowance ?? null };
  }
  return { kind: "Missing", reason: "unrecognised permission" };
}

const IMPLICIT = /^[0-9a-f]{64}$/;

/** True when the account is a NEAR-implicit account and the key is the one its name is derived from. */
export function isDerivedImplicitKey(accountId: string, publicKey: string): boolean {
  if (!IMPLICIT.test(accountId) || !publicKey.startsWith("ed25519:")) return false;
  try {
    return Buffer.from(bs58.decode(publicKey.slice(8))).toString("hex") === accountId;
  } catch {
    return false;
  }
}

export interface TxKeyFacts {
  signer: string;
  publicKey: string;
  permission: Permission;
  /** Present when the transaction carries a NEP-366 delegate action: the inner (user) signature. */
  delegate?: { sender: string; publicKey: string; permission: Permission } | null;
}

/**
 * Buckets one transaction.
 * - A delegate action is classified by its inner signer's key, in its own bucket, never folded in.
 * - A NEAR-implicit account signing with the key its name is derived from is IMPLICIT_FULL, since
 *   that key was never added by an AddKey action.
 * - A key the chain did not know at signing time is UNKNOWN.
 */
export function classify(t: TxKeyFacts): Bucket {
  if (t.delegate) {
    const p = t.delegate.permission;
    if (p.kind === "FunctionCall") return "DELEGATED_INNER_FC";
    if (p.kind === "FullAccess") return "DELEGATED_INNER_FULL";
    return "UNKNOWN";
  }
  const p = t.permission;
  if (p.kind === "FunctionCall") return "FUNCTION_CALL";
  if (p.kind === "FullAccess") return isDerivedImplicitKey(t.signer, t.publicKey) ? "IMPLICIT_FULL" : "FULL_ACCESS";
  // The event ledger never sees the derived key of an implicit account (no AddKey created it).
  if (isDerivedImplicitKey(t.signer, t.publicKey)) return "IMPLICIT_FULL";
  return "UNKNOWN";
}

// ---- The event-ledger form used by the BigQuery path (sql/02): replay ADD_KEY / DELETE_KEY. ----

export interface KeyEvent {
  account: string;
  publicKey: string;
  kind: "ADD_KEY" | "DELETE_KEY";
  /** Present on ADD_KEY. */
  permission?: Permission;
  /** Block timestamp in ns, plus an index to order events inside one block. */
  ts: bigint;
  idx: number;
}

/**
 * The permission of (account, key) at time `ts` from a list of key events: the latest ADD_KEY
 * strictly before `ts` with no DELETE_KEY after it and before `ts`. Same rule as sql/02.
 */
export function permissionAt(events: KeyEvent[], account: string, publicKey: string, ts: bigint): Permission {
  let current: Permission = { kind: "Missing", reason: "no key event before signing time" };
  const mine = events
    .filter((e) => e.account === account && e.publicKey === publicKey && e.ts < ts)
    .sort((a, b) => (a.ts === b.ts ? a.idx - b.idx : a.ts < b.ts ? -1 : 1));
  for (const e of mine) {
    if (e.kind === "ADD_KEY") current = e.permission ?? { kind: "Missing", reason: "ADD_KEY without permission" };
    else current = { kind: "Missing", reason: "deleted before signing time" };
  }
  return current;
}
