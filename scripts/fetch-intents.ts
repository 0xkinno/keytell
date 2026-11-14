// NEAR Intents weekly volume, sampled (a secondary outcome: not part of the registered test, because the
// Explorer key arrived after registration). The Intents Explorer API has no totals endpoint and allows one
// request per 5 seconds per partner, so each ISO week draws 12 seeded random 10-minute windows
// (mulberry32, seed sha256("keytell-intents-v1|<week>")), reads every successful transaction in each, and
// scales the mean window by the 1,008 windows in a week. A window that returns the 1,000-row cap is
// paged until complete. Resumable. Needs INTENTS_EXPLORER_JWT in .env.local (an Explorer key, never committed).
// Writes data/raw/intents/<week>.json, data/raw/intents_weekly.csv and data/raw/intents.meta.json.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const env = existsSync(".env.local") ? Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])) : {};
const JWT = process.env.INTENTS_EXPLORER_JWT ?? env.INTENTS_EXPLORER_JWT;
if (!JWT) { console.error("INTENTS_EXPLORER_JWT missing (.env.local)"); process.exit(1); }
const API = "https://explorer.near-intents.org/api/v0/transactions";
const WINDOWS = 12, WIN_MIN = 10, PER_WEEK = (7 * 24 * 60) / WIN_MIN;
const FROM = process.argv.includes("--from") ? process.argv[process.argv.indexOf("--from") + 1] : "2025-06-23";
const TO = process.argv.includes("--to") ? process.argv[process.argv.indexOf("--to") + 1] : "2026-11-09";
const DIR = "data/raw/intents";
mkdirSync(DIR, { recursive: true });

function prng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function isoWeek(d: Date) { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7); return `${y}-W${String(w).padStart(2, "0")}`; }
let last = 0;
async function get(params: Record<string, string>): Promise<any[]> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const wait = last + 5600 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const r = await fetch(`${API}?${new URLSearchParams(params)}`, { headers: { Authorization: `Bearer ${JWT}` } });
    if (r.status === 429) { await new Promise((x) => setTimeout(x, 6000)); continue; }
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
    return r.json();
  }
  throw new Error("rate limited six times");
}
async function windowRows(start: Date, end: Date) {
  const base = { numberOfTransactions: "1000", statuses: "SUCCESS", startTimestamp: start.toISOString(), endTimestamp: end.toISOString() };
  let rows = await get(base), pages = 1;
  while (rows.length === 1000 * pages) {
    const tail = rows[rows.length - 1];
    rows = rows.concat(await get({ ...base, lastDepositAddress: tail.depositAddress, ...(tail.depositMemo ? { lastDepositMemo: tail.depositMemo } : {}), direction: "next" }));
    pages++;
  }
  return { rows, pages };
}

const mondays: Date[] = [];
for (let d = new Date(`${FROM}T00:00:00Z`); d <= new Date(`${TO}T00:00:00Z`); d = new Date(d.getTime() + 7 * 864e5)) mondays.push(d);
for (const monday of mondays) {
  const week = isoWeek(monday), file = `${DIR}/${week}.json`;
  if (existsSync(file)) continue;
  const seed = parseInt(createHash("sha256").update(`keytell-intents-v1|${week}`).digest("hex").slice(0, 8), 16);
  const rnd = prng(seed), picks = new Set<number>();
  while (picks.size < WINDOWS) picks.add(Math.floor(rnd() * PER_WEEK));
  const windows = [];
  for (const i of [...picks].sort((a, b) => a - b)) {
    const start = new Date(monday.getTime() + i * WIN_MIN * 60_000), end = new Date(start.getTime() + WIN_MIN * 60_000);
    const { rows, pages } = await windowRows(start, end);
    windows.push({ start: start.toISOString(), tx: rows.length, usd: rows.reduce((a, x) => a + (Number(x.amountInUsd) || 0), 0), pages });
  }
  const mean = windows.reduce((a, w) => a + w.usd, 0) / WINDOWS;
  writeFileSync(file, JSON.stringify({ week, monday: monday.toISOString().slice(0, 10), seed: `keytell-intents-v1|${week}`, windows, est_usd: mean * PER_WEEK, est_tx: (windows.reduce((a, w) => a + w.tx, 0) / WINDOWS) * PER_WEEK }, null, 1) + "\n");
  console.log(`${week}: ${windows.map((w) => w.tx).join(" ")} tx; est ${Math.round(mean * PER_WEEK).toLocaleString("en-US")} USD`);
}

// Weekly table with a bootstrap interval over windows (2,000 resamples, fixed seed).
const rows = ["week,monday,est_usd,est_usd_lo,est_usd_hi,est_tx,windows,window_minutes"];
const boot = prng(20261115);
for (const f of readdirSync(DIR).filter((x) => x.endsWith(".json")).sort()) {
  const j = JSON.parse(readFileSync(`${DIR}/${f}`, "utf8"));
  const v = j.windows.map((w: any) => w.usd), n = v.length, est: number[] = [];
  for (let b = 0; b < 2000; b++) { let s = 0; for (let k = 0; k < n; k++) s += v[Math.floor(boot() * n)]; est.push((s / n) * PER_WEEK); }
  est.sort((a, b) => a - b);
  rows.push([j.week, j.monday, Math.round(j.est_usd), Math.round(est[50]), Math.round(est[1949]), Math.round(j.est_tx), n, WIN_MIN].join(","));
}
writeFileSync("data/raw/intents_weekly.csv", rows.join("\n") + "\n");
writeFileSync("data/raw/intents.meta.json", JSON.stringify({ fetched_at: new Date().toISOString(), source: API, statuses: "SUCCESS", windows_per_week: WINDOWS, window_minutes: WIN_MIN, seed: "keytell-intents-v1|<ISO week>", weeks: rows.length - 1, first_week: rows[1]?.split(",")[0], last_week: rows.at(-1)?.split(",")[0], coverage_note: "The Explorer returns no transactions before late June 2025." }, null, 2) + "\n");
console.log(`wrote data/raw/intents_weekly.csv (${rows.length - 1} weeks)`);
