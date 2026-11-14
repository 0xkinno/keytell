// README and X-post screenshots from the deployed app, at 2x. Every page is scrolled first so the
// reveal-on-scroll sections are drawn. Usage: BASE=https://keytell.vercel.app node e2e/screens.mjs
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE ?? "https://keytell.vercel.app";
const OUT = "docs/screens";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function open(path, settle = 1500) {
  await page.goto(BASE + path, { waitUntil: "load" });
  await page.waitForTimeout(settle);
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 350) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 70)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(800);
}
async function plate(question, file) {
  const el = page.locator("section.plate").filter({ has: page.locator("h2", { hasText: question }) }).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(700);
  await el.screenshot({ path: `${OUT}/${file}` });
  console.log(`wrote ${OUT}/${file}`);
}

// Banner: the hero with the Key Wall settled.
await page.goto(BASE + "/", { waitUntil: "load" });
await page.waitForTimeout(4500);
await page.screenshot({ path: `${OUT}/hero.png` });
console.log(`wrote ${OUT}/hero.png`);

// The verdict plates under Tolu's question (for the X post).
await open("/");
const real = page.locator("#real");
await real.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await real.screenshot({ path: `${OUT}/verdict.png` });
console.log(`wrote ${OUT}/verdict.png`);

// The key mix chart on the landing page.
const who = page.locator("#who");
await who.scrollIntoViewIfNeeded();
await page.waitForTimeout(900);
await who.screenshot({ path: `${OUT}/keymix.png` });
console.log(`wrote ${OUT}/keymix.png`);

// Product shots.
await open("/evidence");
await plate("How much does each signal improve", "evidence.png");
await open("/against");
await plate("Could the timing be luck", "against.png");
await open("/keys");
await page.fill("#acct", "relay.tg");
await page.click("button[type=submit]");
await page.waitForSelector("text=/Recent transactions signed by/i", { timeout: 60_000 });
await page.waitForTimeout(800);
await page.evaluate(() => window.scrollTo(0, 60));
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/keys.png` });
console.log(`wrote ${OUT}/keys.png`);
await open("/proof", 1000);
await page.waitForSelector("text=/9 of 9/", { timeout: 90_000 }).catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/proof.png` });
console.log(`wrote ${OUT}/proof.png`);

await browser.close();
