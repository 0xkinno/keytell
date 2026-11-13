// House copy rules: no em dash, no en dash, no emoji, no hype words, in any tracked text file.
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const BANNED_WORDS = [
  "seamless", "seamlessly", "revolutionary", "revolutionize", "game-changer", "game-changing",
  "cutting-edge", "delve", "synergy", "paradigm", "unleash", "supercharge", "next-gen",
  "blazing", "world-class", "groundbreaking", "effortless", "effortlessly", "magic", "magical",
];
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}\u{FE0F}]/u;
const DASHES = /[–—]/;

const files = execSync("git ls-files -z", { encoding: "utf8" })
  .split("\0")
  .filter(Boolean)
  .filter((f) => /\.(md|ts|tsx|js|mjs|css|rs|json|yml|yaml|toml|txt|html|csv|svg)$/i.test(f))
  .filter((f) => !/(lock\.json|lock\.yaml|Cargo\.lock)$/.test(f))
  .filter((f) => f !== "scripts/check-copy.ts");

const problems: string[] = [];
for (const f of files) {
  if (!existsSync(f)) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (DASHES.test(line)) problems.push(`${f}:${i + 1} em or en dash`);
    if (EMOJI.test(line)) problems.push(`${f}:${i + 1} emoji`);
    const lower = line.toLowerCase();
    for (const w of BANNED_WORDS) {
      if (new RegExp(`(^|[^a-z-])${w}([^a-z-]|$)`).test(lower)) problems.push(`${f}:${i + 1} banned word "${w}"`);
    }
  });
}
if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`FAIL check-copy: ${problems.length} problems`);
  process.exit(1);
}
console.log(`PASS check-copy: ${files.length} files clean`);
