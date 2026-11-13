// Mainnet read helpers for the sampler: archival RPC with failover, the FastNEAR block archive,
// a seeded PRNG, ISO weeks, and a small concurrency pool. No keys are needed for any of it.
import { createHash } from "node:crypto";

export const ARCHIVAL_RPCS = (process.env.ARCHIVAL_RPC_URLS ??
  "https://archival-rpc.mainnet.fastnear.com,https://archival-rpc.mainnet.near.org").split(",");
export const BLOCK_ARCHIVE = process.env.BLOCK_ARCHIVE ?? "https://mainnet.neardata.xyz/v0/block";

export const USDC_NATIVE = "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1";
export const USDC_BRIDGED = "a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.factory.bridge.near";
export const USDC_IDS = new Set([USDC_NATIVE, USDC_BRIDGED]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function retry<T>(fn: () => Promise<T>, tries = 7, label = ""): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (process.env.DEBUG) console.error(`retry ${label}: ${String((e as Error)?.message ?? e).slice(0, 300)}`);
      await sleep(Math.min(20_000, 400 * 2 ** i) + Math.random() * 300);
    }
  }
  throw new Error(`${label} failed after ${tries} tries: ${String((last as Error)?.message ?? last)}`);
}

/** Free current-state RPC (fast) and archival RPC (state as of any past block, rate-limited). */
// Four public mainnet RPCs from docs.near.org/api/rpc/providers; each sustains about 4 req/s here.
export const CURRENT_RPCS = (process.env.CURRENT_RPC_URLS ?? "https://rpc.mainnet.fastnear.com,https://free.rpc.fastnear.com,https://rpc.intea.rs,https://api.zan.top/near-mainnet").split(",");
const CURRENT_RATE = Number(process.env.CURRENT_RATE ?? "3.5"); // per endpoint, per second
const ARCHIVAL_RATE = Number(process.env.ARCHIVAL_RATE ?? "4"); // requests per second

/** A simple spacing limiter: at most `perSec` starts per second across all callers. */
function limiter(perSec: number) {
  let nextAt = 0;
  return async () => {
    const now = Date.now();
    const at = Math.max(now, nextAt);
    nextAt = at + 1000 / perSec;
    if (at > now) await sleep(at - now);
  };
}
const archivalGate = limiter(ARCHIVAL_RATE);
const currentGates = CURRENT_RPCS.map(() => limiter(CURRENT_RATE));
let rr = 0;

async function rpcOn(urls: string[], gate: (() => Promise<void>) | null, method: string, params: unknown, tries = 8): Promise<any> {
  let n = 0;
  return retry(async () => {
    if (gate) await gate();
    // The first endpoint takes every call; the others only on retries.
    const url = urls[n++ < 3 ? 0 : n % urls.length];
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(20_000),
    });
    if (r.status === 429 || r.status >= 500) throw new Error(`${url} ${r.status}`);
    const j: any = await r.json();
    if (j.error) {
      const name = j.error?.cause?.name ?? j.error?.name ?? "";
      // Answers about the chain (unknown block, unknown key) are results, not outages.
      if (/UNKNOWN_BLOCK|UNKNOWN_ACCESS_KEY|UNKNOWN_ACCOUNT|GARBAGE_COLLECTED/.test(name) || /does not exist/.test(JSON.stringify(j.error))) {
        return { error: name || "HANDLER_ERROR" };
      }
      throw new Error(`${url} ${JSON.stringify(j.error).slice(0, 200)}`);
    }
    if (j.result?.error) return { error: String(j.result.error) };
    return j.result;
  }, tries, method);
}

/** Archival call (any past block), paced to ARCHIVAL_RATE per second. */
export const rpc = (method: string, params: unknown, tries = 8) => rpcOn(ARCHIVAL_RPCS, archivalGate, method, params, tries);
/** Current-state call, spread round-robin over the public RPCs, each paced on its own. */
export async function rpcNow(method: string, params: unknown): Promise<any> {
  const i = rr++ % CURRENT_RPCS.length;
  const order = [...CURRENT_RPCS.slice(i), ...CURRENT_RPCS.slice(0, i)];
  const gates = [...currentGates.slice(i), ...currentGates.slice(0, i)];
  let k = 0;
  // Rotate endpoints on every retry, each through its own pacing gate.
  return retry(async () => {
    const j = k++ % order.length;
    await gates[j]();
    return rpcOn([order[j]], null, method, params, 1);
  }, 10, method);
}

/** Header timestamp (ns) for a height, or null if the height was skipped. */
export async function blockTime(height: number): Promise<bigint | null> {
  const r = await rpc("block", { block_id: height });
  if (r?.error) return null;
  return BigInt(r.header.timestamp);
}

/** A full block (with chunks, transactions and receipt outcomes) from the archive, or null if skipped. */
export async function archiveBlock(height: number): Promise<any | null> {
  return retry(async () => {
    const r = await fetch(`${BLOCK_ARCHIVE}/${height}`, { redirect: "follow", signal: AbortSignal.timeout(60_000) });
    if (r.status === 429 || r.status >= 500) throw new Error(`archive ${r.status}`);
    if (r.status === 404) return null;
    const text = await r.text();
    if (text.trim() === "null") return null;
    return JSON.parse(text);
  }, 8, `block ${height}`);
}

/** Permission of an access key as of a block hash, the way the protocol stored it (archival). */
export async function viewAccessKey(accountId: string, publicKey: string, blockHash: string): Promise<any> {
  return rpc("query", { request_type: "view_access_key", block_id: blockHash, account_id: accountId, public_key: publicKey }, 5);
}

/** Permission of an access key now (free RPC). A key's permission is fixed when it is added, so a
 *  key that exists now had this permission at any earlier signing, unless it was deleted and then
 *  re-added with a different permission in between (the rerun reports how often keys are missing). */
export async function viewAccessKeyNow(accountId: string, publicKey: string): Promise<any> {
  return rpcNow("query", { request_type: "view_access_key", finality: "final", account_id: accountId, public_key: publicKey });
}

/** mulberry32 seeded from sha256(label): the same label gives the same sample on every machine. */
export function prng(label: string): () => number {
  let a = createHash("sha256").update(label).digest().readUInt32LE(0);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ISO week label (e.g. 2025-W03) and Monday start for a UTC date. */
export function isoWeek(d: Date): { label: string; monday: Date } {
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const thursday = new Date(monday.getTime() + 3 * 86_400_000);
  const year = thursday.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4.getTime() - ((jan4.getUTCDay() + 6) % 7) * 86_400_000);
  const n = Math.round((monday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1;
  return { label: `${year}-W${String(n).padStart(2, "0")}`, monday };
}

/** Runs `fn` over items with at most `n` in flight; keeps order of results. */
export async function pool<T, R>(items: T[], n: number, fn: (x: T, i: number) => Promise<R>, onDone?: (done: number) => void): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
        done++;
        onDone?.(done);
      }
    }),
  );
  return out;
}

export const sha256hex = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");
