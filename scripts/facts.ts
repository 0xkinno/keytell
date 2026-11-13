// Writes docs/FACTS.json: every number the README, UI and video may show, each traced to the file it
// came from, plus the plain sentences under each chart, generated from the numbers (never typed).
// Also writes app/lib/generated/*.json for the app. `--check` fails if the committed FACTS.json
// differs from a fresh build (CI runs it), so no number can drift from its source.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const read = (p: string): any => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null);
const sha = (p: string) => (existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : null);

function csv(p: string): Record<string, string>[] {
  if (!existsSync(p)) return [];
  const [head, ...lines] = readFileSync(p, "utf8").trim().split("\n");
  const cols = splitCsv(head);
  return lines.filter(Boolean).map((l) => Object.fromEntries(splitCsv(l).map((v, i) => [cols[i], v])));
}
function splitCsv(line: string): string[] {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { out.push(cur); cur = ""; } else cur += c;
  }
  out.push(cur);
  return out;
}
const n = (v: string | undefined) => (v === undefined || v === "" || v === "nan" ? null : Number(v));
const r4 = (x: number | null) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4);
const r6 = (x: number | null) => (x === null || !Number.isFinite(x) ? null : Math.round(x * 1e6) / 1e6);
const pct = (x: number | null, d = 1) => (x === null ? "n/a" : `${(x * 100).toFixed(d)} percent`);

const IN_START = "2023-10-16", IN_END = "2024-12-23", OOS_START = "2024-12-30", OOS_END = "2026-11-02", FORWARD_START = "2026-11-16";
const windowOf = (m: string) => (m < IN_START ? "early" : m <= IN_END ? "in_sample" : m <= OOS_END ? "out_of_sample" : m >= FORWARD_START ? "forward" : "gap");

function sqlFiles() {
  const runs = existsSync("data/out/bq_runs.jsonl") ? readFileSync("data/out/bq_runs.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  return readdirSync("sql").filter((f) => f.endsWith(".sql")).sort().map((f) => {
    const text = readFileSync(`sql/${f}`, "utf8");
    const header = text.split("\n").filter((l) => l.startsWith("--")).map((l) => l.replace(/^--\s?/, "")).join("\n");
    const purpose = (header.match(/Purpose: ([\s\S]*?)(\n[A-Z][a-z-]+:|$)/)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const body = text.split("\n").filter((l) => !l.startsWith("--")).join("\n").trim();
    const mine = runs.filter((r) => r.sql === `sql/${f}`);
    return {
      file: `sql/${f}`, purpose, header, body, sha256: createHash("sha256").update(text).digest("hex"),
      ran: mine.length > 0,
      runs: mine.map((r) => ({ start: r.start, end: r.end, bytes_billed: r.bytes_billed, rows: r.rows, out: r.out, out_sha256: r.out_sha256, ran_at: r.ran_at, usd: r.usd_at_on_demand_price })),
      not_run_reason: mine.length ? null : (header.match(/NOT RUN[^.]*\.([^\n]*)/)?.[0] ?? null),
    };
  });
}

export function buildFacts() {
  const weeklyRows = csv("data/out/weekly.csv");
  const results = read("data/out/results.json");
  const controls = read("data/out/controls.json");
  const reg = read("data/registration.json");
  const dep = read("deployments/testnet.json");
  const crank = read("data/crank-last.json");
  const brk = read("data/break.json");
  const conc = read("data/out/concentration_top10.json");
  const priceMeta = read("data/raw/price.meta.json");
  const receivers = csv("data/out/fc_receivers.csv");
  const episodes = csv("data/out/episodes.csv");
  const dirs = csv("data/out/directions.csv");
  const runs = existsSync("data/out/bq_runs.jsonl") ? readFileSync("data/out/bq_runs.jsonl", "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];

  const epSet = new Set(episodes.map((e) => e.monday));
  const weekly = weeklyRows.map((w) => ({
    week: w.week, monday: w.monday, window: windowOf(w.monday),
    fc_share: r4(n(w.fc_share)), fc_share_lo: r4(n(w.fc_share_lo)), fc_share_hi: r4(n(w.fc_share_hi)),
    fc_only_share: r4(n(w.fc_only_share)), unknown_share: r4(n(w.unknown_share)),
    delegated_share: r4(((n(w.n_delegated_inner_fc) ?? 0) + (n(w.n_delegated_inner_full) ?? 0)) / (n(w.txs_classified) || 1)),
    implicit_share: r4((n(w.n_implicit_full) ?? 0) / (n(w.txs_classified) || 1)),
    full_share: r4((n(w.n_full_access) ?? 0) / (n(w.txs_classified) || 1)),
    fc_tx: n(w.fc_tx_census) === null ? null : Math.round(n(w.fc_tx_census)!),
    census_tx: n(w.census_tx), daa: n(w.daa) === null ? null : Math.round(n(w.daa)!),
    price: r4(n(w.price)), usdc: n(w.usdc_census) === null ? null : Math.round(n(w.usdc_census)!),
    tx_sampled_estimate: n(w.tx_count) === null ? null : Math.round(n(w.tx_count)!),
    txs_classified: n(w.txs_classified), episode: epSet.has(w.monday),
  }));

  // The twelve forward weeks of the on-chain claim, as placeholders until they are measured.
  for (let i = 0; i < 12; i++) {
    const monday = new Date(Date.parse(`${FORWARD_START}T00:00:00Z`) + i * 7 * 86_400_000).toISOString().slice(0, 10);
    if (weekly.some((w) => w.monday === monday)) continue;
    weekly.push({ week: `forward ${i + 1}`, monday, window: "forward", fc_share: null, fc_share_lo: null, fc_share_hi: null, fc_only_share: null, unknown_share: null, delegated_share: null, implicit_share: null, full_share: null, fc_tx: null, census_tx: null, daa: null, price: null, usdc: null, tx_sampled_estimate: null, txs_classified: null, episode: false } as any);
  }
  const sampled = weekly.filter((w) => w.fc_share !== null);
  const scored = weekly.filter((w) => w.window === "out_of_sample" && w.fc_share !== null);
  const lastWeek = sampled.at(-1) ?? null;
  const maxUnknown = sampled.reduce((m, w) => Math.max(m, w.unknown_share ?? 0), 0);
  const unknownOver5 = weekly.filter((w) => (w.window === "in_sample" || w.window === "out_of_sample") && (w.unknown_share ?? 0) > 0.05).map((w) => w.week);
  const blocksSampled = weeklyRows.reduce((s, w) => s + (n(w.blocks_sampled) ?? 0), 0);
  const txsClassified = weeklyRows.reduce((s, w) => s + (n(w.txs_classified) ?? 0), 0);
  const txsSeen = weeklyRows.reduce((s, w) => s + (n(w.txs_in_sampled_blocks) ?? 0), 0);
  const archival = weeklyRows.reduce((s, w) => s + (n(w.archival_lookups) ?? 0), 0);
  // How well the sampled transaction estimate tracks the census: median absolute percentage error.
  const ape = weekly.filter((w) => w.census_tx && w.tx_sampled_estimate).map((w) => Math.abs(w.tx_sampled_estimate! - w.census_tx!) / w.census_tx!).sort((a, b) => a - b);
  const sampleVsCensusMape = ape.length ? ape[Math.floor(ape.length / 2)] : null;

  const rebuildRuns = runs.filter((r) => ["sql/04_daa.sql", "sql/05_usdc_volume.sql"].includes(r.sql));
  const rebuildBytes = rebuildRuns.reduce((s, r) => s + r.bytes_billed, 0);
  const rebuildUsd = rebuildRuns.reduce((s, r) => s + r.usd_at_on_demand_price, 0);

  const g = results?.oos_gain_vs_ar2 ?? null;
  const comp = results?.comparisons ?? null;
  const dirCount = (cand: string, kind: string) => dirs.filter((d) => d.candidate === cand && d.kind === kind).length;
  const topScopes = receivers.slice(0, 50).map((r) => ({ scope: r.fc_receiver, sampled_fc_txs: Number(r.sampled_fc_txs), share_of_fc: r4(n(r.share_of_fc)), weeks_seen: Number(r.weeks_seen) }));
  const top10Share = r4(receivers.slice(0, 10).reduce((s, r) => s + (n(r.share_of_fc) ?? 0), 0));

  const verdictChain = crank?.claim_status ?? "Open";
  const facts = {
    _note: "Generated by scripts/facts.ts from committed files. Do not edit by hand.",
    claim: reg ? {
      id: reg.claim_id, statement: reg.claim.statement, ledger: reg.ledger, network: "testnet",
      registration_tx: reg.tx, registered_at_ns: reg.registered_at_ns,
      registered_at: reg.registered_at_ns ? new Date(Number(BigInt(reg.registered_at_ns) / 1_000_000n)).toISOString() : null,
      method_sha256: reg.claim.method_sha256, sql_sha256: reg.claim.sql_sha256, data_commit: reg.claim.data_commit,
      method_sha256_matches_repo: sha("docs/METHOD.md") === reg.claim.method_sha256,
      sql_sha256_matches_repo: sha("docs/CODE_MANIFEST.sha256") === reg.claim.sql_sha256,
      threshold_e6: Number(reg.claim.threshold_e6), min_periods: reg.claim.min_periods, comparator: reg.claim.comparator,
      window_start_ns: reg.claim.window_start_ns, window_end_ns: reg.claim.window_end_ns,
      forward_weeks: Math.round((Number(BigInt(reg.claim.window_end_ns) - BigInt(reg.claim.window_start_ns)) / 1e9) / 604800),
      status_at_last_crank: verdictChain, file: "data/registration.json",
    } : null,
    deployment: dep ? {
      ledger: dep.ledger, crank: dep.crank, publisher: dep.publisher, crank_post_key: dep.crank_post_key,
      crank_post_key_permission: dep.crank_post_key_permission, code_hash_b58: dep.code_hashes.thesis_ledger.wasm_sha256_b58,
      code_hash_hex: dep.code_hashes.thesis_ledger.wasm_sha256_hex, ledger_access_keys: dep.access_keys.ledger, txs: dep.txs,
      file: "deployments/testnet.json",
    } : null,
    windows: { in_sample: [IN_START, IN_END], out_of_sample: [OOS_START, OOS_END], forward_start: FORWARD_START, early_note: "Weeks before 2023-10-16 are shown but not scored: BigQuery ft_events holds USDC.e only from 2023-10-11." },
    data: {
      weeks_sampled: sampled.length, first_week: sampled[0]?.week ?? null, last_week: lastWeek?.week ?? null,
      blocks_sampled: blocksSampled, transactions_seen_in_sampled_blocks: txsSeen, transactions_classified: txsClassified,
      archival_lookups: archival, max_unknown_share: r4(maxUnknown), weeks_unknown_over_5pct: unknownOver5,
      sample_vs_census_tx_median_abs_pct_error: r4(sampleVsCensusMape),
      census_last_day: runs.length ? runs.map((r) => r.end).sort().at(-1) : null,
      bigquery_dataset: "bigquery-public-data.crypto_near_mainnet_us",
      price_source: priceMeta?.source ?? null, price_fetched_at: priceMeta?.fetched_at ?? null,
    },
    latest: lastWeek ? {
      week: lastWeek.week, fc_share: lastWeek.fc_share, fc_share_lo: lastWeek.fc_share_lo, fc_share_hi: lastWeek.fc_share_hi,
      delegated_share: lastWeek.delegated_share, implicit_share: lastWeek.implicit_share, full_share: lastWeek.full_share,
      fc_tx: lastWeek.fc_tx, daa: lastWeek.daa, census_tx: lastWeek.census_tx,
    } : null,
    backtest: results ? {
      verdict: results.verdict, passed: results.passed, oos_weeks_scored: results.oos_weeks_scored,
      best_in_sample_lag: results.best_in_sample_lag,
      oos_gain: Object.fromEntries(Object.entries(g ?? {}).map(([k, v]) => [k, r6(v as number)])),
      vs_daa: comp?.daa ? { mean_sq_error_difference: r6(comp.daa.mean_sq_error_difference), ci95: comp.daa.ci95.map((x: number) => r6(x)), headline_better: comp.daa.headline_better } : null,
      vs_price: comp?.price ? { mean_sq_error_difference: r6(comp.price.mean_sq_error_difference), ci95: comp.price.ci95.map((x: number) => r6(x)), headline_better: comp.price.headline_better } : null,
      directions: {
        fc_signed_tx: { hits: dirCount("fc_signed_tx", "hit"), false_alarms: dirCount("fc_signed_tx", "false_alarm"), misses: dirCount("fc_signed_tx", "miss"), quiet: dirCount("fc_signed_tx", "quiet") },
        daa: { hits: dirCount("daa", "hit"), false_alarms: dirCount("daa", "false_alarm"), misses: dirCount("daa", "miss"), quiet: dirCount("daa", "quiet") },
        price: { hits: dirCount("price", "hit"), false_alarms: dirCount("price", "false_alarm"), misses: dirCount("price", "miss"), quiet: dirCount("price", "quiet") },
      },
      file: "data/out/results.json",
    } : null,
    controls: controls ? {
      placebo: { reps: controls.placebo.reps, real_oos_gain: r6(controls.placebo.real_oos_gain), placebo_p95: r6(controls.placebo.placebo_p95), share_beaten: r4(controls.placebo.share_of_placebos_beaten), real_beats_95pct: controls.placebo.real_beats_95pct },
      variants: Object.fromEntries(Object.entries(controls.variants).map(([k, v]: [string, any]) => [k, { would_pass: v.would_pass, headline_gain: r6(v.oos_gain_vs_ar2.fc_signed_tx), daa_gain: r6(v.oos_gain_vs_ar2.daa), price_gain: r6(v.oos_gain_vs_ar2.price), weeks: v.weeks }])),
      episodes_flagged: controls.episodes_flagged,
      file: "data/out/controls.json",
    } : null,
    concentration: { top10_scopes_in_sample: conc?.top10_fc_scopes_in_sample ?? [], top10_share_of_sampled_fc_all_weeks: top10Share, top_scopes: topScopes.slice(0, 10), file: "data/out/fc_receivers.csv" },
    cost: {
      rebuild_bytes_billed: rebuildBytes, rebuild_gb: Math.round(rebuildBytes / 1e8) / 10, rebuild_usd_at_on_demand_price: Math.round(rebuildUsd * 100) / 100,
      free_tier_note: "BigQuery bills on-demand queries by bytes scanned; the first 1 TiB each month is free.",
      sampler_keys_needed: 0, file: "data/out/bq_runs.jsonl",
    },
    crank: crank ? { last_run: crank.at, posted: crank.posted ?? [], file: "data/crank-last.json" } : null,
    files: Object.fromEntries(["data/out/results.json", "data/out/weekly.csv", "data/out/controls.json", "data/out/oos_errors.csv", "data/out/bq_runs.jsonl"].map((p) => [p, sha(p)])),
    oos_queries_after_registration: reg ? runs.filter((r) => r.start >= OOS_START).every((r) => Date.parse(r.ran_at) > Number(BigInt(reg.registered_at_ns) / 1_000_000n)) && runs.some((r) => r.start >= OOS_START) : null,
    first_oos_query_at: runs.filter((r) => r.start >= OOS_START).map((r) => r.ran_at).sort()[0] ?? null,
    break_campaign: brk ? { refusals: brk.results?.length ?? 0, all_refused_as_designed: brk.results?.every((r: any) => r.ok_as_designed) ?? false, file: "data/break.json" } : null,
  };

  const s = (facts as any);
  const sentences: Record<string, string> = {};
  if (s.backtest) {
    const b = s.backtest;
    sentences.verdict = `${b.verdict}: over ${b.oos_weeks_scored} out-of-sample weeks, function-call-signed activity cut one-step forecast error for weekly USDC volume by ${pct(b.oos_gain.fc_signed_tx)} against an AR(2) baseline, against ${pct(b.oos_gain.daa)} for daily active accounts and ${pct(b.oos_gain.price)} for price.`;
    sentences.vs_baselines = `Versus DAA the mean squared-error difference is ${b.vs_daa?.mean_sq_error_difference} (95 percent interval ${b.vs_daa?.ci95?.join(" to ")}); versus price ${b.vs_price?.mean_sq_error_difference} (${b.vs_price?.ci95?.join(" to ")}). Negative favours function-call keys; the pass rule needs both intervals below zero.`;
    sentences.directions = `Function-call keys flagged ${b.directions.fc_signed_tx.hits + b.directions.fc_signed_tx.false_alarms} weeks: ${b.directions.fc_signed_tx.hits} hits and ${b.directions.fc_signed_tx.false_alarms} false alarms, with ${b.directions.fc_signed_tx.misses} misses. DAA: ${b.directions.daa.hits} hits, ${b.directions.daa.false_alarms} false alarms, ${b.directions.daa.misses} misses.`;
  }
  if (s.latest) sentences.latest = `In ${s.latest.week}, ${pct(s.latest.fc_share)} of sampled mainnet transactions were signed by a function-call key (95 percent interval ${pct(s.latest.fc_share_lo)} to ${pct(s.latest.fc_share_hi)}); ${pct(s.latest.delegated_share)} were meta transactions relayed for a user.`;
  if (s.controls) sentences.placebo = `The real out-of-sample gain (${pct(s.controls.placebo.real_oos_gain)}) beats ${pct(s.controls.placebo.share_beaten, 0)} of ${s.controls.placebo.reps} timing placebos; the bar is 95 percent.`;
  sentences.concentration = `The ten contracts that function-call keys were most often scoped to carry ${pct(s.concentration.top10_share_of_sampled_fc_all_weeks)} of all sampled function-call transactions.`;
  if (s.data.sample_vs_census_tx_median_abs_pct_error !== null) sentences.sample_check = `The sample's weekly transaction estimate lands within ${pct(s.data.sample_vs_census_tx_median_abs_pct_error)} of the BigQuery census in the median week.`;
  (facts as any).sentences = sentences;

  return { facts, weekly, extras: { sql: sqlFiles(), receivers: topScopes, episodes, results, controls, registration: reg, deployment: dep, crank, brk } };
}

function main() {
  const { facts, weekly, extras } = buildFacts();
  const text = JSON.stringify(facts, null, 2) + "\n";
  if (process.argv.includes("--check")) {
    const committed = existsSync("docs/FACTS.json") ? readFileSync("docs/FACTS.json", "utf8") : "";
    if (committed !== text) {
      console.error("FAIL facts: docs/FACTS.json is stale; run `npm run facts` and commit");
      process.exit(1);
    }
    console.log("PASS facts: docs/FACTS.json matches its sources");
    return;
  }
  writeFileSync("docs/FACTS.json", text);
  mkdirSync("app/lib/generated", { recursive: true });
  const w = (name: string, v: unknown) => writeFileSync(`app/lib/generated/${name}.json`, JSON.stringify(v ?? null) + "\n");
  w("facts", facts);
  w("weekly", weekly);
  w("sql", extras.sql);
  w("receivers", extras.receivers);
  w("episodes", extras.episodes);
  w("chain", { registration: extras.registration, deployment: extras.deployment, crank: extras.crank, break: extras.brk });
  w("evidence", {
    results: extras.results, controls: extras.controls,
    lags: csv("data/out/lags.csv"), correlations: csv("data/out/correlations.csv"),
    directions: csv("data/out/directions.csv"), oos_errors: csv("data/out/oos_errors.csv"),
    placebo: csv("data/out/placebo.csv").map((r) => Number(r.placebo_oos_gain)),
  });
  // Files the browser hashes itself on /proof, served with the app.
  mkdirSync("app/public/proof", { recursive: true });
  for (const [from, to] of [["docs/METHOD.md", "METHOD.md"], ["docs/CODE_MANIFEST.sha256", "CODE_MANIFEST.sha256"], ["data/out/results.json", "results.json"], ["data/out/bq_runs.jsonl", "bq_runs.jsonl"], ["docs/FACTS.json", "FACTS.json"]]) {
    if (existsSync(from)) writeFileSync(`app/public/proof/${to}`, readFileSync(from));
  }
  const memo = existsSync("data/out/memo.md") ? readFileSync("data/out/memo.md", "utf8") : null;
  w("memo", memo ? { markdown: memo, sha256: createHash("sha256").update(memo).digest("hex") } : null);
  console.log("wrote docs/FACTS.json and app/lib/generated/*");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
