// The forward crank. For each forward week that has ended and is not yet on chain, it writes the
// week's inputs and the three forecast errors to data/forward/<monday>.json (from
// data/out/forward_errors.csv, built by `make forward`), then posts the errors and that file's
// SHA-256 to the ledger, signed by the crank's function-call key (limited to `post`). Weeks run in
// order; it stops at the first week whose data is not ready. Writes data/crank-last.json.
// Env: CRANK_ACCOUNT_ID, CRANK_POST_KEY (or ~/.near-credentials/testnet/<crank>.post-key.json).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { account, call, view, readDeployment, explorerTx, refusal, credsDir } from "./lib/near.ts";

const d = readDeployment();
const reg = JSON.parse(readFileSync("data/registration.json", "utf8"));
const WEEK_NS = 604_800n * 1_000_000_000n;

function postKey(): string {
  if (process.env.CRANK_POST_KEY) return process.env.CRANK_POST_KEY;
  const p = join(credsDir(), `${d.crank}.post-key.json`);
  if (!existsSync(p)) throw new Error(`no post key: set CRANK_POST_KEY or create ${p}`);
  return JSON.parse(readFileSync(p, "utf8")).private_key;
}

function csv(p: string): Record<string, string>[] {
  if (!existsSync(p)) return [];
  const [h, ...ls] = readFileSync(p, "utf8").trim().split("\n");
  const cols = h.split(",");
  return ls.filter(Boolean).map((l) => Object.fromEntries(l.split(",").map((v, i) => [cols[i], v])));
}

async function main() {
  const signer = account(process.env.CRANK_ACCOUNT_ID ?? d.crank, postKey() as never);
  const claim = await view<any>(d.ledger, "get_claim", { claim_id: reg.claim_id });
  const start = BigInt(claim.window_start_ns), end = BigInt(claim.window_end_ns);
  const now = BigInt(Date.now()) * 1_000_000n;
  const last = claim.last_period === null || claim.last_period === undefined ? -1 : Number(claim.last_period);
  const errors = csv("data/out/forward_errors.csv");
  const weekly = csv("data/out/weekly.csv");
  const prev = existsSync("data/crank-last.json") ? JSON.parse(readFileSync("data/crank-last.json", "utf8")) : { posted: [] };
  const posted: any[] = prev.posted ?? [];
  const notes: string[] = [];
  mkdirSync("data/forward", { recursive: true });

  for (let p = last + 1; ; p++) {
    const pStart = start + BigInt(p) * WEEK_NS, pEnd = pStart + WEEK_NS;
    if (pEnd > end) { notes.push("every forward week is posted"); break; }
    if (pEnd > now) { notes.push(`period ${p} ends ${new Date(Number(pEnd / 1_000_000n)).toISOString()}; not over yet`); break; }
    const monday = new Date(Number(pStart / 1_000_000n)).toISOString().slice(0, 10);
    const e = errors.find((r) => r.monday === monday);
    const w = weekly.find((r) => r.monday === monday);
    const vals = e ? [e.abs_err_e6_fc_signed_tx, e.abs_err_e6_daa, e.abs_err_e6_price] : [];
    if (!e || !w || vals.some((v) => v === "" || v === undefined)) { notes.push(`period ${p} (${monday}): data not ready; run make forward`); break; }
    const record = { claim_id: reg.claim_id, period: p, monday, inputs: w, abs_err_e6: { fc_signed_tx: Number(vals[0]), daa: Number(vals[1]), price: Number(vals[2]) } };
    const text = JSON.stringify(record, null, 2) + "\n";
    const file = `data/forward/${monday}.json`;
    writeFileSync(file, text);
    const rows_sha256 = createHash("sha256").update(text).digest("hex");
    const runs = existsSync("data/out/bq_runs.jsonl") ? readFileSync("data/out/bq_runs.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l)).filter((r) => r.start <= monday && r.end >= monday) : [];
    const bytes = runs.reduce((s, r) => s + r.bytes_billed, 0);
    const observation = { value_e6: vals[0], baseline_daa_e6: vals[1], baseline_price_e6: vals[2], rows_sha256, bytes_scanned: String(bytes) };
    const r = await call(signer, d.ledger, "post", { claim_id: reg.claim_id, period: p, observation }, { gasT: 30 });
    if (!r.ok) { notes.push(`period ${p}: refused ${refusal(r.logs, r.failure) ?? r.failure} ${r.hash}`); break; }
    posted.push({ period: p, monday, hash: r.hash, rows_sha256, file, gas_burnt: r.gasBurnt.toString(), posted_at: new Date().toISOString() });
    console.log(`posted period ${p} (${monday}) ${explorerTx(r.hash)}`);
  }
  const after = await view<any>(d.ledger, "get_claim", { claim_id: reg.claim_id });
  const out = {
    at: new Date().toISOString(), signer: signer.accountId, key: "function-call key limited to post on " + d.ledger,
    run_url: process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
    claim_status: after.status, posted_on_chain: after.posted, wins: after.wins, posted, notes,
  };
  writeFileSync("data/crank-last.json", JSON.stringify(out, null, 2) + "\n");
  console.log(notes.join("\n"));
  console.log(`claim ${after.status}: ${after.posted} posted, ${after.wins} wins`);
}
main().catch((e) => { console.error(e); process.exit(1); });
