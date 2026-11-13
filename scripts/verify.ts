// Verifies Keytell from a clean clone with no keys. `make verify` first reruns the analysis and fails
// on any drift in data/out or docs/FACTS.json; this script then checks the chain and the files:
//   1. the ledger holds zero access keys and runs the recorded reproducible build
//   2. the claim on chain equals data/registration.json, field by field
//   3. docs/METHOD.md and docs/CODE_MANIFEST.sha256 hash to the values registered on chain, and the
//      manifest matches the files it lists
//   4. every out-of-sample BigQuery query in data/out/bq_runs.jsonl ran after the registration, and
//      every committed query output still hashes to what that run recorded
//   5. every observation on chain carries the SHA-256 of a committed data/forward file, and the
//      claim's posted and wins counters rebuild from the observations
//   6. the crank's post key is a function-call key limited to post on the ledger
// `--tamper` changes one committed byte in memory before the hash checks; the run must then fail.
// Last line: "N of N checks pass".
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import bs58 from "bs58";
import { accessKeys, codeHash, view, readDeployment } from "./lib/near.ts";
import { MANIFEST_FILES, manifestText } from "./register.ts";

const TAMPER = process.argv.includes("--tamper");
const d = readDeployment();
const reg = JSON.parse(readFileSync("data/registration.json", "utf8"));
const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail: string) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`); };
let tampered = false;
function bytes(p: string): Buffer {
  const b = readFileSync(p);
  if (TAMPER && !tampered && p === "docs/METHOD.md") { tampered = true; const c = Buffer.from(b); c[c.length - 2] ^= 1; console.log("TAMPER: flipped one bit of docs/METHOD.md in memory"); return c; }
  return b;
}
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

async function main() {
  const keys = await accessKeys(d.ledger);
  check("ledger has zero access keys", keys.length === 0, `${keys.length} keys on ${d.ledger}`);
  const onChain = await codeHash(d.ledger);
  check("ledger code hash matches the recorded reproducible build", onChain === d.code_hashes.thesis_ledger.wasm_sha256_b58, `chain ${onChain}, recorded ${d.code_hashes.thesis_ledger.wasm_sha256_b58}`);
  const local = "target/near/thesis_ledger/thesis_ledger.wasm";
  if (existsSync(local)) {
    const h = bs58.encode(createHash("sha256").update(readFileSync(local)).digest());
    check("ledger code hash matches the local build", h === onChain, `local ${h} (reproducible only with fleet/repro-build.sh)`);
  }

  const c = await view<any>(d.ledger, "get_claim", { claim_id: reg.claim_id });
  const fields = ["statement", "metric", "outcome", "comparator", "threshold_e6", "window_start_ns", "window_end_ns", "period_secs", "min_periods", "method_sha256", "sql_sha256", "data_commit"];
  const diff = fields.filter((k) => String(c[k]) !== String(reg.claim[k]));
  check("claim on chain equals data/registration.json", diff.length === 0, diff.length ? `differs in ${diff.join(", ")}` : `${fields.length} fields equal; registered ${new Date(Number(BigInt(c.registered_at_ns) / 1_000_000n)).toISOString()}`);
  check("claim was registered before its forward window", BigInt(c.registered_at_ns) < BigInt(c.window_start_ns), `registered ${c.registered_at_ns}, window ${c.window_start_ns}`);

  const mh = sha(bytes("docs/METHOD.md"));
  check("docs/METHOD.md hashes to method_sha256 on chain", mh === c.method_sha256, `${mh} vs ${c.method_sha256}`);
  const manifest = readFileSync("docs/CODE_MANIFEST.sha256", "utf8");
  check("docs/CODE_MANIFEST.sha256 hashes to sql_sha256 on chain", sha(manifest) === c.sql_sha256, `${sha(manifest)} vs ${c.sql_sha256}`);
  const nowText = manifestText();
  const changed = MANIFEST_FILES.filter((f) => !manifest.includes(`${sha(readFileSync(f))}  ${f}`));
  check("every registered SQL, sampler and analysis file is unchanged since registration", nowText === manifest, changed.length ? `changed since registration (see docs/METHOD.md Deviations): ${changed.join(", ")}` : `${MANIFEST_FILES.length} files match`);

  const runs = readFileSync("data/out/bq_runs.jsonl", "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const regMs = Number(BigInt(c.registered_at_ns) / 1_000_000n);
  const oos = runs.filter((r) => r.start >= "2024-12-30");
  check("every out-of-sample BigQuery query ran after the registration", oos.length > 0 && oos.every((r) => Date.parse(r.ran_at) > regMs), oos.map((r) => `${r.sql} ${r.ran_at}`).join("; "));
  const latest = new Map<string, any>();
  for (const r of runs) latest.set(r.out, r);
  const bad = [...latest.values()].filter((r) => !existsSync(r.out) || sha(readFileSync(r.out)) !== r.out_sha256);
  check("every committed BigQuery output matches the hash its run recorded", bad.length === 0, bad.length ? `mismatch: ${bad.map((r) => r.out).join(", ")}` : `${latest.size} outputs`);

  const obs = await view<any[]>(d.ledger, "observations", { claim_id: reg.claim_id });
  const forward = existsSync("data/forward") ? readdirSync("data/forward").filter((f) => f.endsWith(".json")) : [];
  const fileHashes = new Map(forward.map((f) => [sha(readFileSync(`data/forward/${f}`)), f]));
  const unmatched = obs.filter((o) => !fileHashes.has(o.rows_sha256));
  check("every posted observation hashes to a committed data/forward file", unmatched.length === 0, obs.length ? `${obs.length - unmatched.length} of ${obs.length} matched` : "no observation posted yet (forward window opens 2026-11-16)");
  const wins = obs.filter((o) => o.win).length;
  check("claim counters rebuild from the observations", c.posted === obs.length && c.wins === wins, `chain posted ${c.posted} wins ${c.wins}; rebuilt ${obs.length} and ${wins}`);

  const ck = (await accessKeys(d.crank)) as any[];
  const k = ck.find((x) => x.public_key === d.crank_post_key);
  const p = k?.access_key?.permission?.FunctionCall;
  check("crank post key is a function-call key limited to post on the ledger", !!p && p.receiver_id === d.ledger && p.method_names.length === 1 && p.method_names[0] === "post", p ? JSON.stringify(p) : "not found");

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed} of ${results.length} checks pass`);
  process.exit(passed === results.length ? 0 : 1);
}
main().catch((e) => { console.error(`FAIL verify could not run: ${e.message}`); process.exit(1); });
