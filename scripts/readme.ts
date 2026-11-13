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
};

function get(path: string): any {
  return path.split(".").reduce((o, k) => (o === null || o === undefined ? undefined : o[k]), ctx);
}

export function render(): string {
  const tpl = readFileSync("docs/README.template.md", "utf8");
  const missing: string[] = [];
  const out = tpl.replace(/\{\{\s*([\w.]+)(?:\s*\|\s*(\w+))?\s*\}\}/g, (_, path: string, fmt?: string) => {
    const v = get(path);
    if (v === undefined) { missing.push(path); return "n/a"; }
    return fmt ? FORMATS[fmt](v) : typeof v === "object" ? JSON.stringify(v) : String(v);
  });
  if (missing.length) throw new Error(`README template references unknown facts: ${[...new Set(missing)].join(", ")}`);
  return `<!-- Generated from docs/README.template.md by scripts/readme.ts. Edit the template. -->\n${out}`;
}

const text = render();
if (process.argv.includes("--check")) {
  const cur = existsSync("README.md") ? readFileSync("README.md", "utf8") : "";
  if (cur !== text) { console.error("FAIL readme: README.md is stale; run npx tsx scripts/readme.ts"); process.exit(1); }
  console.log("PASS readme: README.md matches docs/FACTS.json");
} else {
  writeFileSync("README.md", text);
  console.log("wrote README.md");
}
