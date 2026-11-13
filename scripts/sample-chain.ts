// The sampled census of who signs NEAR mainnet transactions, re-runnable by anyone with no keys.
//
// For each ISO week in [--from, --to] (Mondays, UTC):
//   1. find the first block height of the week and of the next week (archival RPC, interpolation search)
//   2. draw --blocks heights uniformly from that range with a PRNG seeded by "keytell-v1|<week>",
//      then --txs transactions from those blocks with a PRNG seeded by "keytell-v1|<week>|txs"
//   3. read each block from the FastNEAR block archive: every transaction, plus USDC transfers and
//      contract deploys executed in that block
//   4. classify every transaction's signing key as of the block before it. Tier 1: the key's
//      permission now (free RPC); a permission is fixed when a key is added, so this is the
//      permission at signing unless the key was deleted and re-added since (detected from its nonce,
//      which restarts at height x 1e6 on re-add). Tier 2, for keys missing now or re-added since:
//      view_access_key at the block before the transaction (archival RPC, paced). A key neither tier
//      can read is UNKNOWN, with the reason kept in key_source.
// Writes data/raw/sample/<week>.blocks.csv and <week>.txs.csv (resumable: finished weeks are skipped),
// and data/raw/week_heights.csv. Usage:
//   tsx scripts/sample-chain.ts --from 2022-01-03 --to 2024-12-30 --blocks 100 [--conc 24]
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { archiveBlock, blockTime, isoWeek, pool, prng, rpc, viewAccessKey, viewAccessKeyNow, USDC_IDS, USDC_NATIVE } from "./lib/chain.ts";
import { classify, permissionFromRpc, type Permission } from "./lib/classify.ts";

const arg = (k: string, d?: string) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > 0 ? process.argv[i + 1] : d;
};
const FROM = new Date(`${arg("from", "2022-01-03")}T00:00:00Z`);
const TO = new Date(`${arg("to", "2024-12-30")}T00:00:00Z`);
const BLOCKS = Number(arg("blocks", "60"));
const TXS = Number(arg("txs", "200")); // transactions classified per week (a seeded subsample)
const CONC = Number(arg("conc", "24"));
const OUT = arg("out", "data/raw/sample")!;
const SEED = arg("seed", "keytell-v1")!;
const HEIGHTS = "data/raw/week_heights.csv";
const WEEK_MS = 7 * 86_400_000;

mkdirSync(OUT, { recursive: true });

// Current-state answers do not depend on the week, so each (account, key) is asked once per run.
// The cache is a plain JSONL file; delete it to force fresh lookups.
const NOW_CACHE = `${OUT}/keys_now.jsonl`;
const nowCache = new Map<string, any>();
if (existsSync(NOW_CACHE)) {
  for (const line of readFileSync(NOW_CACHE, "utf8").split("\n")) {
    if (!line) continue;
    try { const r = JSON.parse(line); nowCache.set(r.id, r.v); } catch {}
  }
}
async function keyNow(account: string, key: string): Promise<any> {
  const id = `${account}|${key}`;
  if (nowCache.has(id)) return nowCache.get(id);
  const v = await viewAccessKeyNow(account, key);
  const slim = v?.error ? { error: String(v.error).slice(0, 80) } : { nonce: v.nonce, permission: v.permission };
  nowCache.set(id, slim);
  appendFileSync(NOW_CACHE, JSON.stringify({ id, v: slim }) + "\n");
  return slim;
}

// ---------- 1. week boundaries ----------
const heights = new Map<string, number>(); // monday ISO date -> first height at or after it
if (existsSync(HEIGHTS)) {
  for (const line of readFileSync(HEIGHTS, "utf8").trim().split("\n").slice(1)) {
    const [monday, h] = line.split(",");
    heights.set(monday, Number(h));
  }
}

/** Timestamp of the first existing block at or after h, with that block's height. */
async function timeAtOrAfter(h: number): Promise<{ h: number; ts: bigint }> {
  for (let k = 0; k < 50; k++) {
    const ts = await blockTime(h + k);
    if (ts !== null) return { h: h + k, ts };
  }
  throw new Error(`no block within 50 heights of ${h}`);
}

let tip: { h: number; ts: bigint } | null = null;
async function firstHeightAtOrAfter(t: Date): Promise<number> {
  const key = t.toISOString().slice(0, 10);
  if (heights.has(key)) return heights.get(key)!;
  const T = BigInt(t.getTime()) * 1_000_000n;
  if (!tip) {
    const s = await rpc("block", { finality: "final" });
    tip = { h: s.header.height, ts: BigInt(s.header.timestamp) };
  }
  let lo = { h: 9_820_210, ts: (await timeAtOrAfter(9_820_210)).ts }; // genesis height
  let hi = tip;
  if (T > hi.ts) throw new Error(`${key} is after the chain tip`);
  // Interpolation search, then bisection once the bracket is small.
  for (let step = 0; hi.h - lo.h > 1 && step < 80; step++) {
    let mid: number;
    if (step < 12 && hi.h - lo.h > 2000) {
      const frac = Number(T - lo.ts) / Number(hi.ts - lo.ts);
      mid = Math.min(hi.h - 1, Math.max(lo.h + 1, lo.h + Math.round(frac * (hi.h - lo.h))));
    } else mid = Math.floor((lo.h + hi.h) / 2);
    const m = await timeAtOrAfter(mid);
    if (m.h >= hi.h) { hi = { h: mid, ts: hi.ts }; continue; }
    if (m.ts >= T) hi = m;
    else lo = m;
  }
  heights.set(key, hi.h);
  return hi.h;
}

function saveHeights() {
  const rows = [...heights].sort((a, b) => a[0].localeCompare(b[0])).map(([m, h]) => `${m},${h}`);
  writeFileSync(HEIGHTS, "monday,first_height\n" + rows.join("\n") + "\n");
}

// ---------- helpers ----------
const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const actionName = (a: any): string => (typeof a === "string" ? a : Object.keys(a)[0]);

interface UsdcOut { transfers: number; volumeE6: bigint; nativeE6: bigint }

/** USDC moved by receipts executed in this block: NEP-141 ft_transfer events, else successful
 *  ft_transfer / ft_transfer_call arguments for contracts that log no events. */
function usdcInBlock(block: any): UsdcOut {
  const out: UsdcOut = { transfers: 0, volumeE6: 0n, nativeE6: 0n };
  for (const s of block.shards ?? []) {
    for (const r of s.receipt_execution_outcomes ?? []) {
      const o = r.execution_outcome?.outcome;
      if (!o || !USDC_IDS.has(o.executor_id)) continue;
      const ok = o.status && (o.status.SuccessValue !== undefined || o.status.SuccessReceiptId !== undefined);
      let sawEvent = false;
      for (const l of o.logs ?? []) {
        if (!l.startsWith("EVENT_JSON:")) continue;
        try {
          const e = JSON.parse(l.slice(11));
          if (e.standard === "nep141" && e.event === "ft_transfer") {
            sawEvent = true;
            for (const d of e.data ?? []) {
              const amt = BigInt(d.amount);
              out.transfers++;
              out.volumeE6 += amt;
              if (o.executor_id === USDC_NATIVE) out.nativeE6 += amt;
            }
          }
        } catch {}
      }
      if (sawEvent || !ok) continue;
      for (const a of r.receipt?.receipt?.Action?.actions ?? []) {
        const fc = typeof a === "object" ? a.FunctionCall : null;
        if (!fc || !["ft_transfer", "ft_transfer_call"].includes(fc.method_name)) continue;
        try {
          const args = JSON.parse(Buffer.from(fc.args, "base64").toString());
          const amt = BigInt(args.amount);
          out.transfers++;
          out.volumeE6 += amt;
          if (o.executor_id === USDC_NATIVE) out.nativeE6 += amt;
        } catch {}
      }
    }
  }
  return out;
}

function deploysInBlock(block: any): number {
  let n = 0;
  for (const s of block.shards ?? []) {
    for (const r of s.receipt_execution_outcomes ?? []) {
      const o = r.execution_outcome?.outcome;
      if (!o || !(o.status && (o.status.SuccessValue !== undefined || o.status.SuccessReceiptId !== undefined))) continue;
      for (const a of r.receipt?.receipt?.Action?.actions ?? []) if (actionName(a) === "DeployContract") n++;
    }
  }
  return n;
}

// ---------- 2-4. one week ----------
async function sampleWeek(monday: Date) {
  const { label } = isoWeek(monday);
  const blocksFile = `${OUT}/${label}.blocks.csv`;
  const txsFile = `${OUT}/${label}.txs.csv`;
  if (existsSync(blocksFile) && existsSync(txsFile)) return { label, skipped: true };
  const h0 = await firstHeightAtOrAfter(monday);
  const h1 = await firstHeightAtOrAfter(new Date(monday.getTime() + WEEK_MS));
  saveHeights();
  const rand = prng(`${SEED}|${label}`);
  const picked = new Set<number>();
  while (picked.size < Math.min(BLOCKS, h1 - h0)) picked.add(h0 + Math.floor(rand() * (h1 - h0)));
  const sample = [...picked].sort((a, b) => a - b);

  const blockRows: string[] = [];
  const txs: any[] = [];
  await pool(sample, CONC, async (h) => {
    const b = await archiveBlock(h);
    if (!b) {
      blockRows.push([label, h, 0, "", 0, 0, 0, 0, 0].join(","));
      return;
    }
    const hdr = b.block.header;
    let n = 0;
    for (const s of b.shards ?? []) {
      for (const t of s.chunk?.transactions ?? []) {
        n++;
        const tx = t.transaction;
        const acts = (tx.actions ?? []).map(actionName);
        const del = (tx.actions ?? []).find((a: any) => typeof a === "object" && a.Delegate)?.Delegate?.delegate_action ?? null;
        const ok = t.outcome?.execution_outcome?.outcome?.status;
        txs.push({
          week: label, height: h, hash: tx.hash, signer: tx.signer_id, key: tx.public_key, receiver: tx.receiver_id, nonce: String(tx.nonce),
          del_nonce: del ? String(del.nonce) : "",
          actions: acts.join("|"), method: (tx.actions ?? []).map((a: any) => a?.FunctionCall?.method_name).filter(Boolean)[0] ?? "",
          del_sender: del?.sender_id ?? "", del_key: del?.public_key ?? "", del_receiver: del?.receiver_id ?? "",
          prev: hdr.prev_hash, converted: ok && ok.Failure === undefined ? 1 : 0,
        });
      }
    }
    const u = usdcInBlock(b);
    blockRows.push([label, h, 1, hdr.timestamp, n, u.transfers, u.volumeE6, u.nativeE6, deploysInBlock(b)].join(","));
  });

  // Stage two: a seeded random subsample of TXS transactions is classified. Totals come from every
  // transaction in the sampled blocks (blocks.csv n_tx); the key mix comes from the subsample.
  const allTx = txs.length;
  txs.sort((a, b) => a.height - b.height || a.hash.localeCompare(b.hash));
  const r2 = prng(`${SEED}|${label}|txs`);
  for (let i = txs.length - 1; i > 0; i--) { const j = Math.floor(r2() * (i + 1)); [txs[i], txs[j]] = [txs[j], txs[i]]; }
  txs.length = Math.min(txs.length, TXS);

  // Classify each distinct (account, key) once per week, as of the first block it signed in.
  const lookups = new Map<string, { account: string; key: string; prev: string; height: number; nonce: bigint }>();
  for (const t of txs) {
    const pairs: [string, string, string][] = [[t.signer, t.key, t.nonce]];
    if (t.del_sender) pairs.push([t.del_sender, t.del_key, t.del_nonce || "0"]);
    for (const [account, key, nonce] of pairs) {
      const id = `${account}|${key}`;
      const cur = lookups.get(id);
      if (!cur || t.height < cur.height) lookups.set(id, { account, key, prev: t.prev, height: t.height, nonce: BigInt(nonce || "0") });
    }
  }
  const perms = new Map<string, Permission>();
  const source = new Map<string, string>();
  const needArchive: [string, typeof lookups extends Map<string, infer V> ? V : never][] = [];
  await pool([...lookups.entries()], CONC, async ([id, l]) => {
    let now: any;
    try { now = await keyNow(l.account, l.key); } catch { needArchive.push([id, l]); return; }
    if (!now?.error) {
      const addedAt = BigInt(now.nonce) / 1_000_000n;
      // Re-added after this signing: the current nonce restarted above this transaction's height.
      if (addedAt > BigInt(l.height) && l.nonce < addedAt * 1_000_000n) { needArchive.push([id, l]); return; }
      perms.set(id, permissionFromRpc(now));
      source.set(id, "now");
      return;
    }
    needArchive.push([id, l]);
  });
  await pool(needArchive, 4, async ([id, l]) => {
    try {
      const r = await viewAccessKey(l.account, l.key, l.prev);
      perms.set(id, permissionFromRpc(r));
      source.set(id, r?.error ? "archival_missing" : "archival");
    } catch {
      perms.set(id, { kind: "Missing", reason: "archival lookup unavailable" });
      source.set(id, "archival_unavailable");
    }
  });

  const header = "week,height,hash,signer,public_key,receiver,actions,method,converted,del_sender,del_key,del_receiver,key_kind,fc_receiver,fc_methods,del_key_kind,del_fc_receiver,key_source,bucket";
  const lines = txs
    .sort((a, b) => a.height - b.height || a.hash.localeCompare(b.hash))
    .map((t) => {
      const p = perms.get(`${t.signer}|${t.key}`)!;
      const dp = t.del_sender ? perms.get(`${t.del_sender}|${t.del_key}`)! : null;
      const bucket = classify({ signer: t.signer, publicKey: t.key, permission: p, delegate: dp ? { sender: t.del_sender, publicKey: t.del_key, permission: dp } : null });
      return [
        t.week, t.height, t.hash, t.signer, t.key, t.receiver, t.actions, t.method, t.converted, t.del_sender, t.del_key, t.del_receiver,
        p.kind, p.kind === "FunctionCall" ? p.receiver_id : "", p.kind === "FunctionCall" ? p.method_names.join("|") : "",
        dp ? dp.kind : "", dp && dp.kind === "FunctionCall" ? dp.receiver_id : "",
        source.get(`${t.signer}|${t.key}`) + (t.del_sender ? `/${source.get(`${t.del_sender}|${t.del_key}`)}` : ""), bucket,
      ].map(csvCell).join(",");
    });
  blockRows.sort((a, b) => Number(a.split(",")[1]) - Number(b.split(",")[1]));
  writeFileSync(`${txsFile}.tmp`, header + "\n" + lines.join("\n") + (lines.length ? "\n" : ""));
  writeFileSync(`${blocksFile}.tmp`, "week,height,exists,timestamp_ns,n_tx,usdc_transfers,usdc_volume_e6,usdc_native_e6,deploys\n" + blockRows.join("\n") + "\n");
  // Write meta: the height range so weekly totals can be scaled from the sample.
  writeFileSync(`${OUT}/${label}.meta.json`, JSON.stringify({ week: label, monday: monday.toISOString().slice(0, 10), first_height: h0, next_week_first_height: h1, heights_in_week: h1 - h0, sampled: sample.length, seed: `${SEED}|${label}`, txs_in_sampled_blocks: allTx, txs_classified: txs.length, lookups: lookups.size, archival_lookups: needArchive.length }) + "\n");
  renameSync(`${txsFile}.tmp`, txsFile);
  renameSync(`${blocksFile}.tmp`, blocksFile);
  return { label, skipped: false, blocks: sample.length, txs: txs.length, lookups: lookups.size, archival: needArchive.length };
}

async function main() {
  const weeks: Date[] = [];
  for (let t = isoWeek(FROM).monday.getTime(); t <= TO.getTime(); t += WEEK_MS) weeks.push(new Date(t));
  console.log(`sampling ${weeks.length} weeks, ${BLOCKS} blocks each, concurrency ${CONC}`);
  const started = Date.now();
  for (const w of weeks) {
    const t = Date.now();
    const r = await sampleWeek(w);
    if (!r.skipped) console.log(`${r.label}: ${r.blocks} blocks, ${r.txs} txs, ${r.lookups} key lookups (${r.archival} archival), ${((Date.now() - t) / 1000).toFixed(0)}s`);
  }
  console.log(`done in ${((Date.now() - started) / 60000).toFixed(1)} min`);
}
main().catch((e) => { console.error(e); process.exit(1); });
