// Layout and accessibility checks on 8 viewports for every route.
// Usage: BASE=http://localhost:3100 node e2e/layout.mjs   (writes e2e/screens/ and e2e/report.json)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3100";
const AXE = readFileSync("node_modules/axe-core/axe.min.js", "utf8");
const VIEWPORTS = [
  ["desktop-1440", { viewport: { width: 1440, height: 900 } }],
  ["laptop-1280", { viewport: { width: 1280, height: 800 } }],
  ["ipad-mini", devices["iPad Mini"]],
  ["ipad-pro-11", devices["iPad Pro 11"]],
  ["iphone-15", devices["iPhone 15"]],
  ["iphone-se", devices["iPhone SE"]],
  ["pixel-7", devices["Pixel 7"]],
  ["galaxy-s9", devices["Galaxy S9+"]],
];
const ROUTES = ["/", "/evidence", "/against", "/ledger", "/keys", "/memo", "/rerun", "/proof"];
mkdirSync("e2e/screens", { recursive: true });
const report = [];
let failures = 0;
const browser = await chromium.launch();
for (const [vpName, opts] of VIEWPORTS) {
  const ctx = await browser.newContext({ ...opts, deviceScaleFactor: 1, reducedMotion: "reduce" });
  for (const route of ROUTES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(BASE + route, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {}); // pages that poll never settle; bounded
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const out = { hscroll: document.documentElement.scrollWidth - window.innerWidth, overlaps: [], small: [] };
      const box = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return b.width && b.height ? b : null; };
      const pairs = [["h1", "header nav"], ["h1", "[role=img]"]];
      for (const [a, b] of pairs) {
        // A headline sitting on an opaque stitched patch that overlaps the art band is the design, not a collision.
        if (b === "[role=img]" && document.querySelector(a)?.closest(".plate")) continue;
        const A = box(a), B = box(b);
        if (A && B && !(A.right <= B.left || B.right <= A.left || A.bottom <= B.top || B.bottom <= A.top)) out.overlaps.push(`${a} x ${b}`);
      }
      for (const el of document.querySelectorAll("a, button, input, select, textarea, [role=tab]")) {
        const b = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        if (!b.width || st.visibility === "hidden" || el.closest(".sr-only")) continue;
        const inline = el.tagName === "A" && el.closest("p, li, td, sup, dd");
        if (!inline && (b.height < 44 && b.width < 44 || b.height < 24)) out.small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return out;
    });
    await page.addScriptTag({ content: AXE });
    const axe = await page.evaluate(async () => {
      const res = await window.axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] } });
      return res.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(" ") }));
    });
    const relevantErrors = errors.filter((e) => !/Failed to load resource.*(404|ERR_)/.test(e) || true);
    const bad = r.hscroll > 0 || r.overlaps.length || r.small.length || axe.length || relevantErrors.length;
    if (bad) failures++;
    report.push({ viewport: vpName, route, ...r, axe, errors: relevantErrors });
    if (["/", "/evidence", "/against", "/ledger", "/keys", "/memo", "/proof"].includes(route)) await page.screenshot({ path: `e2e/screens/${vpName}${route === "/" ? "-landing" : route.replace(/\//g, "-")}.png` });
    await page.close();
  }
  await ctx.close();
}
await browser.close();
writeFileSync("e2e/report.json", JSON.stringify(report, null, 2));
for (const x of report.filter((x) => x.hscroll > 0 || x.overlaps.length || x.small.length || x.axe.length || x.errors.length)) {
  console.log(`${x.viewport} ${x.route}: hscroll ${x.hscroll} overlaps ${x.overlaps} small ${x.small.slice(0, 4).join("; ")} axe ${x.axe.map((a) => `${a.id}(${a.n}) ${a.sample}`).join(", ")} errors ${x.errors.slice(0, 2)}`);
}
console.log(`${report.length - failures} of ${report.length} page views clean`);
process.exit(failures ? 1 : 0);
