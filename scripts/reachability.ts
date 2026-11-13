// Checks that the deployed app and its machine-readable twins answer. Usage: APP_URL=... tsx scripts/reachability.ts
const APP = process.env.APP_URL || "https://keytell.vercel.app";
const paths = ["/", "/evidence", "/against", "/ledger", "/keys", "/memo", "/rerun", "/proof", "/proof.json", "/api/status", "/api/lookup?account=aurora"];
let bad = 0;
for (const p of paths) {
  const t = Date.now();
  try {
    const r = await fetch(APP + p, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.status} ${p} ${Date.now() - t}ms`);
    if (!r.ok) bad++;
  } catch (e) {
    console.log(`FAIL ${p} ${(e as Error).message}`);
    bad++;
  }
}
console.log(`${paths.length - bad} of ${paths.length} reachable at ${APP}`);
process.exit(bad ? 1 : 0);
