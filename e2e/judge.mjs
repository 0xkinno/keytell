// The judge's path, end to end in a real browser: classify a known account on /keys, open a chart's
// SQL on /evidence, run /proof and read the result line. Usage: BASE=http://localhost:3100 node e2e/judge.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:3100";
const steps = [];
const step = (name, ok, detail) => { steps.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`); };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

await page.goto(`${BASE}/keys`, { waitUntil: "load" });
await page.fill("#acct", "aurora");
await page.click("button[type=submit]");
await page.waitForSelector("text=Keys on aurora now", { timeout: 90_000 }).catch(() => {});
const keysText = await page.textContent("body");
step("/keys classifies a known account", /Keys on aurora now/.test(keysText) && /full-access key/.test(keysText), keysText.match(/\d+ function-call keys?, \d+ full-access keys?/)?.[0] ?? "no key summary");

await page.goto(`${BASE}/evidence`, { waitUntil: "load" });
const summary = page.locator("summary", { hasText: "Show the SQL" }).first();
await summary.click();
const sqlText = await page.locator("details[open] pre.sql").first().textContent().catch(() => "");
step("/evidence opens a chart's SQL", /bigquery-public-data\.crypto_near_mainnet_us/.test(sqlText ?? ""), (sqlText ?? "").split("\n")[0]);

await page.goto(`${BASE}/proof`, { waitUntil: "load" });
await page.waitForFunction(() => /\d+ of \d+ checks pass/.test(document.body.innerText), null, { timeout: 90_000 }).catch(() => {});
const line = (await page.textContent("body")).match(/(\d+) of (\d+) checks pass/);
step("/proof runs every check from chain", !!line && line[1] === line[2], line ? line[0] : "no result line");

await browser.close();
const pass = steps.filter((s) => s.ok).length;
console.log(`${pass} of ${steps.length} judge steps pass`);
process.exit(pass === steps.length ? 0 : 1);
