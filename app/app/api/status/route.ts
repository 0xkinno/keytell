import { NextResponse } from "next/server";
import facts from "@/lib/generated/facts.json";

export const dynamic = "force-dynamic";

// Measured probes, never hard-coded. KEYTELL_FAULT=stale_bq|intents_down|rpc_down shows the
// designed degraded states, labelled, instead of silent fallbacks.
async function probe(name: string, fn: () => Promise<string>) {
  const t = Date.now();
  try {
    const detail = await fn();
    return { name, ok: true, ms: Date.now() - t, detail };
  } catch (e) {
    return { name, ok: false, ms: Date.now() - t, detail: String((e as Error).message ?? e).slice(0, 160) };
  }
}

async function rpcStatus(url: string) {
  const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "status", params: [] }), signal: AbortSignal.timeout(5000), cache: "no-store" });
  const j = await r.json();
  return `${j.result.chain_id} block ${j.result.sync_info.latest_block_height}`;
}

export async function GET() {
  const f = facts as any;
  const fault = process.env.KEYTELL_FAULT ?? null;
  const probes = await Promise.all([
    probe("NEAR testnet RPC (ledger)", async () => { if (fault === "rpc_down") throw new Error("designed degraded state: KEYTELL_FAULT=rpc_down"); return rpcStatus("https://rpc.testnet.fastnear.com"); }),
    probe("NEAR mainnet RPC (/keys)", async () => { if (fault === "rpc_down") throw new Error("designed degraded state: KEYTELL_FAULT=rpc_down"); return rpcStatus("https://free.rpc.fastnear.com"); }),
    probe("FastNEAR transaction API (/keys)", async () => {
      const r = await fetch("https://tx.main.fastnear.com/v0/account", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ account_id: "aurora", limit: 1 }), signal: AbortSignal.timeout(5000), cache: "no-store" });
      return `HTTP ${r.status}`;
    }),
    probe("NearBlocks API (not used by /keys)", async () => {
      const r = await fetch("https://api.nearblocks.io/v1/stats", { signal: AbortSignal.timeout(5000), cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}; /keys reads FastNEAR instead`);
      return `HTTP ${r.status}`;
    }),
    probe("FastNEAR block archive (sampler)", async () => {
      const r = await fetch("https://mainnet.neardata.xyz/v0/last_block/final", { signal: AbortSignal.timeout(6000), cache: "no-store", redirect: "follow" });
      const j = await r.json();
      return `block ${j.block.header.height}`;
    }),
    probe("NEAR Intents Explorer API", async () => {
      if (fault === "intents_down") throw new Error("designed degraded state: KEYTELL_FAULT=intents_down");
      const r = await fetch("https://explorer.near-intents.org/api/v0/openapi.yaml", { signal: AbortSignal.timeout(5000), cache: "no-store" });
      return `OpenAPI reachable, HTTP ${r.status}; weekly volume is sampled offline by scripts/fetch-intents.ts with a partner key this server never holds`;
    }),
    probe("BigQuery data freshness", async () => {
      if (fault === "stale_bq") throw new Error("designed degraded state: KEYTELL_FAULT=stale_bq; charts show committed data through the last census day");
      return `committed census through ${f.data.census_last_day}; queries run by make rebuild with credentials, not by this server`;
    }),
  ]);
  return NextResponse.json({ at: new Date().toISOString(), fault, probes }, { headers: { "cache-control": "no-store" } });
}
