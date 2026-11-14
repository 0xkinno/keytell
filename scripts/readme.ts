// Renders README.md from docs/README.template.md, filling every {{path.to.fact}} from docs/FACTS.json
// (plus {{app.url}} and {{repo.url}} from deployments/app.json). No number in the README is typed by
// hand. `--check` fails if README.md is stale (CI runs it). An unknown path fails the render.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const facts = JSON.parse(readFileSync("docs/FACTS.json", "utf8"));
const app = existsSync("deployments/app.json") ? JSON.parse(readFileSync("deployments/app.json", "utf8")) : { url: "https://keytell.vercel.app", repo: "https://github.com/0xkinno/keytell" };
const ctx: any = { ...facts, app: { url: app.url }, repo: { url: app.repo } };

const FORMATS: Record<string, (v: any) => string> = {
  pct: (v) => (v === null || v === undefined ? "n/a" : `${(Number(v) * 100).toFixed(1)}%`),
  pct0: (v) => (v === null || v === undefined ? "n/a" : `${(Number(v) * 100).toFixed(0)}%`),
  int: (v) => (v === null || v === undefined ? "n/a" : Number(v).toLocaleString("en-US")),
  short: (v) => String(v).slice(0, 16),
  date: (v) => String(v).slice(0, 10),
  list: (v) => (Array.isArray(v) && v.length ? v.join(", ") : "none"),
  bool: (v) => (v ? "yes" : "no"),
  effect: (v) => (v === null || v === undefined ? "n/a" : `${Math.abs(Number(v) * 100).toFixed(1)}% ${Number(v) >= 0 ? "better" : "worse"}`),
  txlink: (v) => (v ? `[${String(v).slice(0, 10)}...](https://testnet.nearblocks.io/txns/${v})` : "none: the protocol refused it before a transaction existed"),
  explorer: (v) => `https://testnet.nearblocks.io/txns/${v}`,
  pass: (v) => (v ? "**passes**" : "fails"),
  signed: (v) => (v === null || v === undefined ? "n/a" : `${Number(v) >= 0 ? "+" : "-"}${Math.abs(Number(v) * 100).toFixed(1)}%`),
};

function get(path: string): any {
  return path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), ctx);
}

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TPL = arg("--tpl", "docs/README.template.md");
const OUT = arg("--out", "README.md");

export function render(): string {
  const tpl = readFileSync(TPL, "utf8");
  const missing: string[] = [];
  // {{#each path}} ... {{.field|fmt}} ... {{/each}} repeats a block for every item of an array fact.
  const expanded = tpl.replace(/\{\{#each\s+([\w.]+)\s*\}\}\n?([\s\S]*?)\{\{\/each\}\}\n?/g, (_, path: string, body: string) => {
    const arr = get(path);
    if (!Array.isArray(arr)) { missing.push(path); return ""; }
    return arr.map((item) => body.replace(/\{\{\s*\.([\w.]+)(?:\s*\|\s*(\w+))?\s*\}\}/g, (__: string, k: string, fmt?: string) => {
      const v = k.split(".").reduce((o: any, kk) => (o == null ? undefined : o[kk]), item);
      if (v === undefined) { missing.push(`${path}[].${k}`); return "n/a"; }
      return fmt ? FORMATS[fmt](v) : String(v);
    })).join("");
  });
  const out = expanded.replace(/\{\{\s*([\w.]+)(?:\s*\|\s*(\w+))?\s*\}\}/g, (_, path: string, fmt?: string) => {
    const v = get(path);
    if (v === undefined) { missing.push(path); return "n/a"; }
    return fmt ? FORMATS[fmt](v) : typeof v === "object" ? JSON.stringify(v) : String(v);
  });
  if (missing.length) throw new Error(`${TPL} references unknown facts: ${[...new Set(missing)].join(", ")}`);
  return `<!-- Generated from ${TPL} by scripts/readme.ts. Edit the template. -->\n${out}`;
}

const text = render();
if (process.argv.includes("--check")) {
  const cur = existsSync(OUT) ? readFileSync(OUT, "utf8") : "";
  if (cur !== text) { console.error(`FAIL readme: ${OUT} is stale; run npx tsx scripts/readme.ts`); process.exit(1); }
  console.log(`PASS readme: ${OUT} matches docs/FACTS.json`);
} else {
  writeFileSync(OUT, text);
  console.log(`wrote ${OUT}`);
}
