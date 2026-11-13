import { NextResponse } from "next/server";
import { accessKeys, accountInfo, rpc, ChainAnswer } from "@/lib/near";

export const dynamic = "force-dynamic";

// Classifies any mainnet account's keys (view_access_key_list, FastNEAR RPC first) and its recent
// signed transactions (FastNEAR transaction API), each by the key that signed it. Keys still on the
// account are classified from current state; a key deleted since is read at the block before the
// transaction on archival RPC (at most 12 distinct keys per lookup). Rate-limited per IP per day and cached 60 s,
// both in this server instance's memory (best effort on serverless). No wallet, no key, read only.
const ACCOUNT = /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;
const LIMIT_PER_DAY = 60;
const hits = new Map<string, { day: string; n: number }>();
const cache = new Map<string, { at: number; body: any }>();
const TX_API = "https://tx.main.fastnear.com/v0";
const ARCHIVAL = "https://archival-rpc.mainnet.fastnear.com";

type Perm = { kind: "FullAccess" } | { kind: "FunctionCall"; receiver_id: string; method_names: string[]; allowance: string | null } | { kind: "Missing"; reason: string };
const toPerm = (p: any): Perm => (p === "FullAccess" ? { kind: "FullAccess" } : p?.FunctionCall ? { kind: "FunctionCall", receiver_id: p.FunctionCall.receiver_id, method_names: p.FunctionCall.method_names ?? [], allowance: p.FunctionCall.allowance ?? null } : { kind: "Missing", reason: "unrecognised" });

async function post(url: string, body: unknown, ms = 6000) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(ms), cache: "no-store" });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

async function archivalKey(account: string, key: string, blockHash: string): Promise<Perm> {
  try {
    const j = await post(ARCHIVAL, { jsonrpc: "2.0", id: 1, method: "query", params: { request_type: "view_access_key", block_id: blockHash, account_id: account, public_key: key } });
    if (j.error || j.result?.error) return { kind: "Missing", reason: "not found at signing time" };
    return toPerm(j.result.permission);
  } catch {
    return { kind: "Missing", reason: "archival lookup unavailable" };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const account = (url.searchParams.get("account") ?? "").trim().toLowerCase();
  if (process.env.KEYTELL_FAULT === "rpc_down") {
    return NextResponse.json({ ok: false, degraded: "rpc_down", reason: "Designed degraded state (KEYTELL_FAULT=rpc_down): RPC is treated as unreachable, so no live lookup is attempted." }, { status: 503 });
  }
  if (!account || account.length < 2 || account.length > 64 || !ACCOUNT.test(account)) {
    return NextResponse.json({ ok: false, reason: "That is not a valid NEAR account id." }, { status: 400 });
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const h = hits.get(ip);
  const n = h && h.day === day ? h.n + 1 : 1;
  hits.set(ip, { day, n });
  if (n > LIMIT_PER_DAY) return NextResponse.json({ ok: false, reason: `Daily limit of ${LIMIT_PER_DAY} lookups reached for your address. Try again tomorrow, or run the sampler yourself.` }, { status: 429 });
  const cached = cache.get(account);
  if (cached && Date.now() - cached.at < 60_000) return NextResponse.json({ ...cached.body, cached: true }, { headers: { "cache-control": "public, s-maxage=60" } });

  try {
    const info = await accountInfo("mainnet", account);
    if (!info) return NextResponse.json({ ok: false, reason: `${account} does not exist on NEAR mainnet.` }, { status: 404 });
    let keys: Awaited<ReturnType<typeof accessKeys>> = [];
    let keysNote: string | null = null;
    try {
      keys = await accessKeys("mainnet", account);
    } catch (e) {
      if (!(e instanceof ChainAnswer) || !/TOO_MANY_ACCESS_KEYS/.test(e.message)) throw e;
      keysNote = "This account holds more access keys than RPC will list in one call (typical of a relayer that gives each user session its own key). Each recent transaction's key is read one by one instead.";
    }
    const keyRows = keys.map((k) => {
      const p = toPerm(k.access_key.permission);
      return { public_key: k.public_key, kind: p.kind, receiver_id: p.kind === "FunctionCall" ? p.receiver_id : null, method_names: p.kind === "FunctionCall" ? p.method_names : null, allowance: p.kind === "FunctionCall" ? p.allowance : null, nonce: k.access_key.nonce };
    });
    const byKey = new Map(keyRows.map((k) => [k.public_key, k]));

    let recent: any[] = [];
    let txSource = "FastNEAR transaction API (tx.main.fastnear.com)";
    try {
      const list = await post(`${TX_API}/account`, { account_id: account, is_signer: true, limit: 20 });
      const hashes = (list.account_txs ?? []).map((t: any) => t.transaction_hash).slice(0, 20); // the API caps a batch at 20
      if (hashes.length) {
        const txs = await post(`${TX_API}/transactions`, { tx_hashes: hashes }, 8000);
        const rows = (txs.transactions ?? []).filter((t: any) => t.transaction.signer_id === account);
        // Keys no longer on the account: one archival read per distinct key, in parallel, at the
        // block its earliest listed transaction landed in (the key existed there when it signed).
        const missing = new Map<string, string>();
        for (const t of rows) {
          const k = t.transaction.public_key;
          if (byKey.has(k)) continue;
          if (keysNote && !missing.has(k)) {
            const one = await rpc<any>("mainnet", "query", { request_type: "view_access_key", finality: "final", account_id: account, public_key: k }).catch(() => null);
            if (one?.permission) {
              const p = toPerm(one.permission);
              byKey.set(k, { public_key: k, kind: p.kind, receiver_id: p.kind === "FunctionCall" ? p.receiver_id : null, method_names: p.kind === "FunctionCall" ? p.method_names : null, allowance: p.kind === "FunctionCall" ? p.allowance : null, nonce: one.nonce } as any);
              continue;
            }
          }
          if (!missing.has(k)) missing.set(k, t.execution_outcome.block_hash);
        }
        const archival = new Map<string, Perm>();
        await Promise.all([...missing].slice(0, 12).map(async ([k, blockHash]) => archival.set(k, await archivalKey(account, k, blockHash))));
        for (const t of rows) {
          const tx = t.transaction;
          const actions = (tx.actions ?? []).map((a: any) => (typeof a === "string" ? a : Object.keys(a)[0]));
          const del = (tx.actions ?? []).find((a: any) => a?.Delegate)?.Delegate?.delegate_action;
          const known = byKey.get(tx.public_key);
          let perm: Perm, source: string;
          if (known) { perm = known.kind === "FunctionCall" ? { kind: "FunctionCall", receiver_id: known.receiver_id!, method_names: known.method_names ?? [], allowance: known.allowance } : { kind: "FullAccess" }; source = "key still on the account"; }
          else if (archival.has(tx.public_key)) { perm = archival.get(tx.public_key)!; source = "archival, at the block it landed in (key deleted since)"; }
          else { perm = { kind: "Missing", reason: "lookup budget used" }; source = "not looked up"; }
          const implicit = /^[0-9a-f]{64}$/.test(account);
          const bucket = del ? "RELAYS_META_TX" : perm.kind === "FunctionCall" ? "FUNCTION_CALL" : perm.kind === "FullAccess" ? (implicit ? "IMPLICIT_OR_FULL" : "FULL_ACCESS") : "UNKNOWN";
          recent.push({ hash: tx.hash, block_height: t.execution_outcome.block_height, at: new Date(Number(BigInt(t.execution_outcome.block_timestamp) / 1_000_000n)).toISOString(), receiver_id: tx.receiver_id, actions, public_key: tx.public_key, permission: perm, bucket, source, relayed_for: del?.sender_id ?? null });
        }
      }
    } catch (e) {
      txSource = `unavailable right now (${(e as Error).message.slice(0, 80)})`;
    }
    recent.sort((a, b) => b.block_height - a.block_height);
    const counts = recent.reduce((m: Record<string, number>, r) => ((m[r.bucket] = (m[r.bucket] ?? 0) + 1), m), {});
    const body = {
      ok: true, account, fetched_at: new Date().toISOString(),
      keys_note: keysNote, keys: keyRows, fc_keys: keyRows.filter((k) => k.kind === "FunctionCall").length, full_keys: keyRows.filter((k) => k.kind === "FullAccess").length,
      recent, counts,
      sources: { keys: "view_access_key_list on free.rpc.fastnear.com (failover to rpc.mainnet.fastnear.com, rpc.mainnet.near.org)", transactions: txSource },
    };
    cache.set(account, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "cache-control": "public, s-maxage=60" } });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: `Could not read mainnet right now: ${(e as Error).message.slice(0, 120)}` }, { status: 502 });
  }
}
