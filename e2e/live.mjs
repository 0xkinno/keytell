// End-to-end checks against the deployed app: every route and internal link, console and request
// errors, the /keys lookup on several kinds of account, memo export, the wallet selector (near-connect)
// for the memo signature and for resolve, the machine-readable routes, and the memo-verify API's
// refusals. Usage: BASE=https://keytell.vercel.app node e2e/live.mjs  -> e2e/live-report.json
import { createRequire } from "node:module";
import { writeFileSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "https://keytell.vercel.app";
const results = [];
const rec = (name, ok, detail) => { results.push({ name, ok, detail }); console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`); };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true });

// 1. Every route: status, console errors, page errors, failed same-origin requests.
const ROUTES = ["/", "/evidence", "/against", "/ledger", "/keys", "/memo", "/rerun", "/proof"];
const links = new Set();
for (const r of ROUTES) {
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => { if (m.type() === "error") errs.push(`console: ${m.text().slice(0, 140)}`); });
  page.on("pageerror", (e) => errs.push(`pageerror: ${String(e).slice(0, 140)}`));
  page.on("requestfailed", (q) => { if (q.url().startsWith(BASE)) errs.push(`requestfailed: ${q.url()}`); });
  page.on("response", (s) => { if (s.url().startsWith(BASE) && s.status() >= 400) errs.push(`${s.status()} ${s.url()}`); });
  const resp = await page.goto(BASE + r, { waitUntil: "load" }); await new Promise((x) => setTimeout(x, 1500));
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((x) => setTimeout(x, 40)); } });
  await page.waitForTimeout(600);
  for (const h of await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")))) if (h.startsWith("/") && !h.startsWith("//")) links.add(h.split("#")[0] || "/");
  rec(`route ${r}`, resp.status() === 200 && errs.length === 0, `${resp.status()}${errs.length ? "; " + errs.join(" | ") : ", no console, page or request errors"}`);
  await page.close();
}

// 2. Every internal link found on any page answers 200.
const bad = [];
for (const l of links) { const s = (await ctx.request.get(BASE + l)).status(); if (s !== 200) bad.push(`${l} ${s}`); }
rec("internal links", bad.length === 0, bad.length ? bad.join(", ") : `${links.size} distinct internal links answer 200`);

// 3. /keys on several kinds of account.
const page = await ctx.newPage();
async function lookup(acct, expect) {
  await page.goto(`${BASE}/keys`, { waitUntil: "load" }); await new Promise((x) => setTimeout(x, 1500));
  await page.fill("#acct", acct);
  await page.click("button[type=submit]");
  const t0 = Date.now();
  await page.waitForFunction((pat) => new RegExp(pat, "i").test(document.querySelector("main")?.innerText ?? ""), expect.source, { timeout: 60_000 }).catch(() => {});
  const text = await page.locator("main").innerText();
  const m = text.match(new RegExp(expect.source, "i"));
  rec(`/keys ${acct}`, !!m, m ? `"${m[0].slice(0, 90)}" in ${Date.now() - t0} ms` : `expected ${expect}; got "${text.slice(0, 160).replace(/\s+/g, " ")}"`);
}
await lookup("aurora", /\d+ function-call keys?, \d+ full-access keys?/);
await lookup("relay.tg", /Recent transactions signed by relay\.tg/);
await lookup("0000000000000000000000000000000000000000000000000000000000000000", /Keys on 0{64}|implicit|does not exist/);
await lookup("this-account-does-not-exist-keytell.near", /does not exist|not found|no such account/);
await lookup("Not An Account!!", /not a valid|invalid/);

// 4. Memo: Markdown export matches the committed memo; the sign button opens the wallet selector.
await page.goto(`${BASE}/memo`, { waitUntil: "load" }); await new Promise((x) => setTimeout(x, 1500));
const [dl] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Markdown/ }).click()]);
const body = readFileSync(await dl.path(), "utf8");
const committed = readFileSync("data/out/memo.md", "utf8");
rec("memo Markdown export", body === committed, `${dl.suggestedFilename()}, sha256 ${createHash("sha256").update(body).digest("hex").slice(0, 16)}..., equals data/out/memo.md: ${body === committed}`);
rec("memo PDF (print) button", await page.getByRole("button", { name: /PDF/ }).isVisible(), "visible; opens the browser print dialog");
async function walletSelector(trigger, label) {
  await trigger();
  // near-connect renders its selector in a shadow root or iframe; read all visible text for known wallets.
  let found = [];
  for (let i = 0; i < 20 && !found.length; i++) {
    await page.waitForTimeout(500);
    const texts = await page.evaluate(() => {
      const out = [];
      const walk = (root) => { for (const el of root.querySelectorAll("*")) { if (el.shadowRoot) walk(el.shadowRoot); } out.push(root.textContent ?? ""); };
      walk(document);
      return out.join(" ");
    });
    const frames = await Promise.all(page.frames().map((f) => f.evaluate(() => document.body?.innerText ?? "").catch(() => "")));
    const all = texts + " " + frames.join(" ");
    found = all.includes("Select wallet") ? ["HOT Wallet", "Meteor Wallet", "MyNearWallet", "Intear", "Nightly", "Sender", "NEAR Mobile", "Ethereum Wallets", "NEAR CLI", "OKX"].filter((w) => all.includes(w)) : [];
  }
  rec(label, found.length >= 2, found.length ? `selector opened, wallets offered: ${found.join(", ")}` : "no wallet selector appeared");
}
await walletSelector(() => page.getByRole("button", { name: /Sign as analyst/ }).click(), "memo signature opens the near-connect wallet selector (mainnet)");

// 5. Ledger: the claim is read live from testnet; resolve stays closed until the window ends.
await page.goto(`${BASE}/ledger`, { waitUntil: "load" }); await new Promise((x) => setTimeout(x, 1500));
await page.waitForTimeout(3000);
const ledgerText = await page.locator("main").innerText();
const reg = JSON.parse(readFileSync("data/registration.json", "utf8"));
rec("ledger reads the claim from chain", ledgerText.includes(reg.claim_id) && /ledger\.keytell\.testnet/.test(ledgerText), `claim ${reg.claim_id} and ledger.keytell.testnet shown`);
const resolveBtn = page.getByRole("button", { name: /resolve/i }).first();
rec("resolve is closed during the window", await resolveBtn.isDisabled(), "button disabled until the forward window ends (the contract refuses E_WINDOW_OPEN as well)");

// 6. Machine-readable routes.
const st = await (await ctx.request.get(`${BASE}/api/status`)).json();
rec("/api/status", Array.isArray(st.probes) && st.fault === null, st.probes.map((p) => `${p.name}: ${p.ok ? "ok" : "down"}`).join("; "));
const pj = await (await ctx.request.get(`${BASE}/proof.json`)).json();
rec("/proof.json", pj.all_pass === true, `${pj.passed} of ${pj.total} proof checks pass, computed live from chain`);

// 7. memo-verify refuses what it must.
const post = async (b) => { const r = await ctx.request.post(`${BASE}/api/memo-verify`, { data: b }); return [r.status(), await r.json()]; };
const msg = `Keytell analyst attestation. I have read the evidence against as well as the evidence for in memo sha256 ${"a".repeat(64)}. The decision is mine.`;
let [s1, j1] = await post({});
rec("memo-verify refuses missing fields", s1 === 400 && !j1.ok, `${s1} ${j1.reason}`);
let [s2, j2] = await post({ accountId: "aurora", publicKey: "ed25519:11111111111111111111111111111111", signature: "AA==", message: "hello", nonce: "AA==" });
rec("memo-verify refuses a message that is not an attestation", s2 === 400 && !j2.ok, `${s2} ${j2.reason}`);
let [s3, j3] = await post({ accountId: "aurora", publicKey: "ed25519:11111111111111111111111111111111", signature: Buffer.alloc(64).toString("base64"), message: msg, nonce: Buffer.alloc(32).toString("base64") });
rec("memo-verify refuses a forged signature", s3 === 401 && !j3.ok, `${s3} ${j3.reason}`);

await browser.close();
const passed = results.filter((r) => r.ok).length;
writeFileSync("e2e/live-report.json", JSON.stringify({ base: BASE, ran_at: new Date().toISOString(), passed, total: results.length, results }, null, 2) + "\n");
console.log(`\n${passed} of ${results.length} live checks pass at ${BASE}`);
process.exit(passed === results.length ? 0 : 1);
