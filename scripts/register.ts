// Registers the Keytell claim on the ledger. Publisher only (keytell.testnet), once.
// method_sha256 = sha256(docs/METHOD.md); sql_sha256 = sha256(docs/CODE_MANIFEST.sha256), the manifest
// listing every SQL, sampler and analysis file with its own sha256; data_commit = the git commit that
// holds all of them. Refuses to run with uncommitted changes in those files.
// Writes data/registration.json.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { account, call, view, readDeployment, explorerTx, milli, events } from "./lib/near.ts";

export const CLAIM_ID = "keytell-fc-leads-usdc-1";
export const MANIFEST_FILES = [
  "sql/00_probe_schema.sql", "sql/01_key_events.sql", "sql/02_tx_classified.sql", "sql/03_weekly_kinds.sql",
  "sql/04_daa.sql", "sql/05_usdc_volume.sql", "sql/06_retention.sql", "sql/07_deploys.sql", "sql/08_concentration.sql",
  "scripts/sample-chain.ts", "scripts/lib/chain.ts", "scripts/lib/classify.ts", "scripts/bq.py",
  "analysis/weekly.py", "analysis/method.py", "analysis/controls.py", "analysis/requirements.txt",
];
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

export function manifestText(): string {
  return MANIFEST_FILES.map((f) => `${sha(readFileSync(f))}  ${f}`).join("\n") + "\n";
}

async function main() {
  const d = readDeployment();
  const write = process.argv.includes("--write-manifest");
  const text = manifestText();
  if (write) {
    writeFileSync("docs/CODE_MANIFEST.sha256", text);
    console.log("wrote docs/CODE_MANIFEST.sha256");
    return;
  }
  if (readFileSync("docs/CODE_MANIFEST.sha256", "utf8") !== text) throw new Error("docs/CODE_MANIFEST.sha256 is stale: run with --write-manifest and commit");
  const dirty = execSync(`git status --porcelain -- docs/METHOD.md docs/CODE_MANIFEST.sha256 ${MANIFEST_FILES.join(" ")}`, { encoding: "utf8" }).trim();
  if (dirty) throw new Error(`commit first:\n${dirty}`);
  const commit = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();

  const start = Date.UTC(2026, 10, 16) * 1_000_000; // Monday 2026-11-16 00:00 UTC, in ns
  const weeks = 12;
  const claim = {
    id: CLAIM_ID,
    statement: "On NEAR, the volume of transactions signed by function-call keys is a better leading indicator of real application usage than daily active accounts or token price.",
    metric: "fc_signed_tx: weekly share of sampled mainnet transactions signed by a function-call key (FUNCTION_CALL or DELEGATED_INNER_FC, classified at signing time) times the BigQuery census transaction count; log change week over week; one-step AR(2)+X forecast at its in-sample lag",
    outcome: "usdc_census: weekly USDC volume on NEAR, receiving side of successful NEP-141 ft_transfer events on native USDC 17208628...e36133a1 and USDC.e (BigQuery ft_events); log change",
    comparator: "LowerBeatsBothShare",
    threshold_e6: "500000",
    window_start_ns: String(start),
    window_end_ns: String(start + weeks * 604_800 * 1_000_000_000),
    period_secs: "604800",
    min_periods: 10,
    method_sha256: sha(readFileSync("docs/METHOD.md")),
    sql_sha256: sha(readFileSync("docs/CODE_MANIFEST.sha256")),
    data_commit: commit,
  };
  const existing = await view<any>(d.ledger, "get_claim", { claim_id: CLAIM_ID });
  if (existing) {
    console.log(`already registered at ${existing.registered_at_ns}`);
    return;
  }
  const pub = account(d.publisher);
  const r = await call(pub, d.ledger, "register", { claim }, { deposit: milli(0.2), gasT: 50 });
  if (!r.ok) throw new Error(`register failed: ${r.failure} ${r.hash}`);
  const ev = events(r.logs)[0];
  const out = { claim_id: CLAIM_ID, ledger: d.ledger, tx: r.hash, explorer: explorerTx(r.hash), registered_at_ns: ev?.data?.[0]?.registered_at_ns, claim, gas_burnt: r.gasBurnt.toString() };
  writeFileSync("data/registration.json", JSON.stringify(out, null, 2) + "\n");
  console.log(JSON.stringify(out, null, 2));
}
if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
