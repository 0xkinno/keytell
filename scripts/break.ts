// The break campaign: every way to cheat thesis_ledger, attempted as a real testnet transaction and
// recorded with its decoded refusal. It runs against a twin ledger (break.ROOT) with the same code
// hash as the real one, so the real claim is never touched, plus one attempt on the real ledger with
// the crank's post-only key. Writes data/break.json.
import { KeyPair, actions } from "near-api-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { account, call, exists, loadKey, saveKey, accessKeys, codeHash, milli, explorerTx, refusal, readDeployment, credsDir } from "./lib/near.ts";

const d = readDeployment();
const ROOT = d.root;
const TWIN = `break.${ROOT}`;
const STRANGER = `stranger.${ROOT}`;
const WASM = readFileSync("target/near/thesis_ledger/thesis_ledger.wasm");
const H = "c".repeat(64);
const NS = 1_000_000_000n;
const results: any[] = [];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const root = account(ROOT);

async function ensure(id: string, near: number) {
  if (await exists(id)) return;
  const kp = KeyPair.fromRandom("ed25519");
  await root.createSubAccount({ accountOrPrefix: id, publicKey: kp.getPublicKey(), nearToTransfer: milli(near) } as never);
  saveKey(id, kp);
}

async function chainNowNs(): Promise<bigint> {
  const r = await fetch("https://rpc.testnet.fastnear.com", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "block", params: { finality: "final" } }) });
  return BigInt((await r.json()).result.header.timestamp);
}

function claim(id: string, start: bigint, periods: number) {
  return { claim: { id, statement: "Break campaign claim (twin ledger)", metric: "m", outcome: "o", comparator: "LowerBeatsBothShare", threshold_e6: "500000", window_start_ns: start.toString(), window_end_ns: (start + BigInt(periods) * 60n * NS).toString(), period_secs: "60", min_periods: 1, method_sha256: H, sql_sha256: H, data_commit: "abcdef1" } };
}
const obs = (v: number) => ({ value_e6: String(v), baseline_daa_e6: "10", baseline_price_e6: "20", rows_sha256: H, bytes_scanned: "1" });

async function attempt(name: string, expected: string, signerId: string, method: string, args: object, opts: { deposit?: bigint; key?: string; contract?: string } = {}) {
  const s = account(signerId, opts.key as never);
  const r = await call(s, opts.contract ?? TWIN, method, args, { deposit: opts.deposit ?? 0n, gasT: 50 });
  // A key-permission refusal comes from the protocol before the transaction exists (no hash).
  const protocol = /does not allow method/i.test(r.failure ?? "") ? "MethodNameMismatch (rejected by the protocol)" : null;
  const got = r.ok ? "OK" : (protocol ?? refusal(r.logs, r.failure) ?? (r.failure?.match(/MethodNotFound|InvalidAccessKey\w*|MethodNameMismatch|ReceiverMismatch|NotEnoughAllowance/)?.[0] ?? r.failure?.slice(0, 80) ?? "failed"));
  const ok_as_designed = expected === "OK" ? r.ok : !r.ok && String(got).includes(expected);
  results.push({ name, expected, got, ok_as_designed, hash: r.hash || null, explorer: r.hash ? explorerTx(r.hash) : null, signer: signerId, method });
  console.log(`${ok_as_designed ? "PASS" : "FAIL"} ${name}: expected ${expected}, got ${got} ${r.hash ? explorerTx(r.hash) : ""}`);
  return r;
}

async function main() {
  await ensure(TWIN, 2);
  await ensure(STRANGER, 0.5);
  if ((await codeHash(TWIN)) !== (await codeHash(d.ledger))) {
    const twin = account(TWIN);
    await twin.signAndSendTransaction({ receiverId: TWIN, actions: [actions.deployContract(WASM), actions.functionCall("new", { publisher: ROOT, crank: d.crank }, 30_000_000_000_000n, 0n)], waitUntil: "FINAL" } as never);
    for (const k of (await accessKeys(TWIN)) as any[]) await twin.deleteKey(k.public_key);
  }
  console.log(`twin ${TWIN}: code hash ${await codeHash(TWIN)} (real ledger ${await codeHash(d.ledger)}), ${(await accessKeys(TWIN)).length} keys`);
  const tag = Date.now().toString(36);
  const now = await chainNowNs();

  await attempt("A stranger registers a claim", "E_NOT_PUBLISHER", STRANGER, "register", claim(`s-${tag}`, now + 600n * NS, 2), { deposit: milli(0.1) });
  await attempt("The publisher registers after the window opened", "E_WINDOW_STARTED", ROOT, "register", claim(`late-${tag}`, now - NS, 2), { deposit: milli(0.1) });
  const start = (await chainNowNs()) + 75n * NS;
  await attempt("The publisher registers a valid claim (control)", "OK", ROOT, "register", claim(`b-${tag}`, start, 2), { deposit: milli(0.1) });
  await attempt("The publisher registers the same id again", "E_CLAIM_EXISTS", ROOT, "register", claim(`b-${tag}`, start, 2), { deposit: milli(0.1) });
  await attempt("The publisher tries to edit the threshold", "MethodNotFound", ROOT, "edit_threshold", { claim_id: `b-${tag}`, threshold_e6: "1" });
  await attempt("Anyone resolves before the window ends", "E_WINDOW_OPEN", STRANGER, "resolve", { claim_id: `b-${tag}` });
  await attempt("A stranger posts an observation", "E_NOT_CRANK", STRANGER, "post", { claim_id: `b-${tag}`, period: 0, observation: obs(1) });
  await attempt("The crank posts before the period has ended", "E_PERIOD_NOT_ENDED", d.crank, "post", { claim_id: `b-${tag}`, period: 0, observation: obs(1) });
  while ((await chainNowNs()) < start + 125n * NS) await sleep(5000);
  await attempt("The crank posts period 1 (control)", "OK", d.crank, "post", { claim_id: `b-${tag}`, period: 1, observation: obs(1) });
  await attempt("The crank backdates a post to period 0", "E_BACKDATE", d.crank, "post", { claim_id: `b-${tag}`, period: 0, observation: obs(1) });
  await attempt("The crank posts period 1 twice", "E_ALREADY_POSTED", d.crank, "post", { claim_id: `b-${tag}`, period: 1, observation: obs(1) });
  await attempt("The crank posts past the window", "E_OUT_OF_WINDOW", d.crank, "post", { claim_id: `b-${tag}`, period: 2, observation: obs(1) });
  await attempt("Anyone resolves after the window (control)", "OK", STRANGER, "resolve", { claim_id: `b-${tag}` });
  await attempt("The crank posts after resolution", "E_RESOLVED", d.crank, "post", { claim_id: `b-${tag}`, period: 1, observation: obs(1) });
  await attempt("Anyone resolves a second time", "E_RESOLVED", STRANGER, "resolve", { claim_id: `b-${tag}` });
  // On the real ledger: the crank's function-call key may call post and nothing else.
  const fc = JSON.parse(readFileSync(join(credsDir(), `${d.crank}.post-key.json`), "utf8"));
  await attempt("The crank's post-only key calls resolve on the real ledger", "MethodNameMismatch", d.crank, "resolve", { claim_id: "keytell-fc-leads-usdc-1" }, { key: fc.private_key, contract: d.ledger });

  const out = { twin: TWIN, twin_code_hash: await codeHash(TWIN), real_code_hash: await codeHash(d.ledger), ran_at: new Date().toISOString(), results };
  writeFileSync("data/break.json", JSON.stringify(out, null, 2) + "\n");
  const pass = results.filter((r) => r.ok_as_designed).length;
  console.log(`${pass} of ${results.length} attempts behaved as designed`);
  process.exit(pass === results.length ? 0 : 1);
}
main().catch((e) => { console.error(e); process.exit(1); });
