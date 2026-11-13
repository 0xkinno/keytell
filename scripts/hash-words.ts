// Prints the sha256 of each lowercase word in a private list, one per line.
// The words themselves are never committed; only their hashes are.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: tsx scripts/hash-words.ts <wordlist>");
  process.exit(2);
}
const words = readFileSync(path, "utf8")
  .split("\n")
  .map((w) => w.trim().toLowerCase())
  .filter(Boolean);
const hashes = [...new Set(words.map((w) => createHash("sha256").update(w).digest("hex")))].sort();
process.stdout.write(hashes.join("\n") + "\n");
