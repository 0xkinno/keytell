// Records the demo video: a scripted tour of the app with on-screen captions, following the
// timeline in the build plan (Tolu's question, the claim on chain, the Key Wall and the primary chart
// with its SQL, the case against, /keys on a real account, make verify, the memo, the verdict).
// Usage: BASE=https://... VERIFY_LOG=e2e/verify.log node e2e/video.mjs  -> e2e/video/keytell-demo.mp4
// The terminal scene replays the real captured output of `make verify` (VERIFY_LOG), labelled as such.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, readdirSync, renameSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "http://localhost:3100";
const OUT = "e2e/video";
const VERIFY = existsSync(process.env.VERIFY_LOG ?? "e2e/verify.log") ? readFileSync(process.env.VERIFY_LOG ?? "e2e/verify.log", "utf8") : "verify log not captured";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: OUT, size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
const wait = (s) => page.waitForTimeout(s * 1000);

async function caption(text, sub = "") {
  await page.evaluate(([t, s]) => {
    let el = document.getElementById("kt-cap");
    if (!el) {
      el = document.createElement("div");
      el.id = "kt-cap";
      el.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:99999;max-width:1100px;background:rgba(11,16,19,.92);color:#eef0f1;border:1px solid rgba(210,122,44,.6);border-radius:14px;padding:14px 22px;font:500 22px/1.35 system-ui,sans-serif;text-align:center;box-shadow:0 20px 40px -20px #000";
      document.body.appendChild(el);
    }
    el.innerHTML = `${t}${s ? `<div style="font:400 15px/1.4 ui-monospace,monospace;color:#d9a46c;margin-top:6px">${s}</div>` : ""}`;
  }, [text, sub]);
}
async function go(path) {
  await page.goto(BASE + path, { waitUntil: "load" });
  await wait(1.2);
}
async function scrollTo(selector) {
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ behavior: "smooth", block: "start" }), selector);
  await wait(1.4);
}

// 0:00 the person and the question
await go("/");
await caption("Monday, 07:40. Tolu Adeyemi has twenty minutes before the investment committee.", "\"Is anyone actually using NEAR, or is it bots and airdrop farmers?\"");
await wait(7);
await caption("Every dashboard shows daily active accounts and price. Both are cheap to fake.", "Keytell counts something harder to fake: transactions signed by NEAR function-call keys");
await wait(7);
await page.mouse.move(1050, 420); await wait(1.5); await page.mouse.move(1180, 560); await wait(2);
await caption("The Key Wall: one key per week since 2022, filled by the share of mainnet transactions signed by a function-call key.", "Classified at signing time from public RPC; hover any key for its week");
await wait(6);

// 0:20 the claim, registered on chain
await go("/ledger");
await caption("The claim was written to a keyless NEAR contract before any out-of-sample data was read.", "statement, threshold, and the SHA-256 of the method and every query: nobody can edit them");
await wait(9);
await scrollTo("section:nth-of-type(2)");
await caption("Zero access keys on the ledger. The crank posts each forward week with a function-call key limited to post.", "the same kind of signature the thesis counts");
await wait(7);

// 0:45 the primary chart and its SQL
await go("/evidence");
await caption("The test: does function-call activity forecast weekly USDC volume better than DAA or price?", "expanding-window one-step forecasts, each signal at the lag chosen on in-sample weeks only");
await wait(8);
await page.locator("summary", { hasText: "Show the SQL" }).first().click(); await wait(1);
await scrollTo("details[open]");
await caption("Every chart shows its exact SQL, the bytes it scanned, and an Open in BigQuery button.", "bigquery-public-data.crypto_near_mainnet_us");
await wait(8);
await scrollTo("section:nth-of-type(2)");
await caption("Out-of-sample forecast gain over an AR(2) baseline, by signal.", "the registered pass rule needs function-call activity to beat both DAA and price, with bootstrap intervals below zero");
await wait(10);

// 1:30 the case against
await go("/against");
await caption("The case against, published with the same weight: every control written down before the test.", "concentration, relayers, unknown keys, episodes, and 1,000 timing placebos");
await wait(9);
await scrollTo("section:nth-of-type(2)");
await caption("Could the timing be luck? The real gain against 1,000 shifted placebos.", "");
await wait(8);
await scrollTo("section:nth-of-type(3)");
await caption("Is it just a few apps? The contracts function-call keys are scoped to, ranked.", "");
await wait(7);

// 2:00 /keys on a real account
await go("/keys");
await page.fill("#acct", "relay.tg");
await caption("Try your own: type any mainnet account.", "relay.tg, a relayer");
await wait(2);
await page.click("button[type=submit]");
await page.waitForSelector("text=Recent transactions signed by", { timeout: 60_000 }).catch(() => {});
await wait(2);
await caption("Its recent transactions, classified by the key that signed them: here, meta transactions relayed for users.", "keys from view_access_key_list; transactions from FastNEAR; no wallet needed");
await wait(9);

// 2:20 make verify from a clean clone (captured output)
await page.setContent(`<html><body style="margin:0;background:#0b1013;color:#d7dde0;font:15px/1.5 ui-monospace,monospace;padding:40px"><div style="color:#d27a2c;margin-bottom:12px">$ git clone https://github.com/0xkinno/keytell && cd keytell && make verify</div><pre id="t" style="white-space:pre-wrap;margin:0"></pre></body></html>`);
await caption("make verify from a clean clone, with no keys: it reruns the analysis and checks every hash against the chain.", "replay of the captured output of a real run");
const lines = VERIFY.trim().split("\n").slice(-26);
for (const l of lines) { await page.evaluate((x) => { document.getElementById("t").textContent += x + "\n"; }, l); await wait(0.35); }
await wait(5);

// 2:45 the memo
await go("/memo");
await caption("The deliverable Tolu already uses: a one-page memo, every number linked to its source.", "exported as Markdown or PDF");
await wait(7);
await page.mouse.move(1260, 330); await wait(1);
await caption("Tolu signs it with their own wallet (NEP-413): an attestation that the evidence against was read.", "a signed message, no transaction, no fee; the server checks the signature");
await wait(8);

// 3:00 the verdict and what would change it
await go("/");
await scrollTo("#real");
await caption("The verdict comes from the data, not from us. The forward claim on chain resolves without us after twelve weeks.", "Keytell: count the small keys, not the accounts. github.com/0xkinno/keytell");
await wait(9);
await scrollTo("#change");
await caption("What would change our mind was written down first.", "#NEARHackathon @NEARProtocol");
await wait(6);

await page.close();
await ctx.close();
await browser.close();
const webm = readdirSync(OUT).filter((f) => f.endsWith(".webm")).map((f) => `${OUT}/${f}`).at(-1);
renameSync(webm, `${OUT}/keytell-demo.webm`);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", `${OUT}/keytell-demo.webm`, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-movflags", "+faststart", `${OUT}/keytell-demo.mp4`]);
console.log(`wrote ${OUT}/keytell-demo.mp4`);
