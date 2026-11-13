// Fails if any tracked text file contains a word whose sha256 is in docs/.wordlist.sha256.
// Works without the private word list, so it runs in CI and in cloud sessions.
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const listPath = "docs/.wordlist.sha256";
if (!existsSync(listPath)) {
  console.error(`missing ${listPath}`);
  process.exit(1);
}
const banned = new Set(readFileSync(listPath, "utf8").split("\n").map((s) => s.trim()).filter(Boolean));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const files = execSync("git ls-files -z", { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((f) => !/\.(png|jpg|jpeg|gif|webp|woff2?|ttf|otf|ico|pdf|wasm|mp3|mp4)$/i.test(f))
  .filter((f) => f !== listPath && !f.endsWith("pnpm-lock.yaml") && !f.endsWith("package-lock.json") && !f.endsWith("Cargo.lock"));

let bad = 0;
for (const file of files) {
  if (!existsSync(file)) continue;
  const text = readFileSync(file, "utf8").toLowerCase();
  const tokens = text.match(/[a-z0-9_./-]+/g) ?? [];
  for (const raw of tokens) {
    const segs = raw.split(/[/.]/).filter(Boolean);
    const candidates = new Set<string>([raw, ...segs]);
    for (let i = 0; i + 1 < segs.length; i++) candidates.add(`${segs[i]}/${segs[i + 1]}`);
    for (const c of candidates) {
      if (banned.has(sha(c))) {
        console.error(`FAIL ${file}: a private word list entry appears`);
        bad++;
        break;
      }
    }
  }
}
if (bad) process.exit(1);
console.log(`PASS check-names: ${files.length} tracked files, no listed words`);
