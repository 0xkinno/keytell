// The proof checks, shared by the browser runner (/proof) and the machine twin (/proof.json).
// Each check reads public NEAR testnet RPC or a file served with the app, and compares it with what
// the chain says. Checks run in parallel and report as each lands.
import { accessKeys, accountInfo, view } from "./near";
import facts from "./generated/facts.json";

export interface Check { id: string; claim: string; ok: boolean | null; detail: string }

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function runChecks(base: string, onUpdate?: (c: Check[]) => void): Promise<{ checks: Check[]; at: string }> {
  const f = facts as any;
  const L = f.claim?.ledger, id = f.claim?.id, crank = f.deployment?.crank;
  const defs: [string, string, () => Promise<[boolean, string]>][] = [
    ["keys", `${L} holds zero access keys, so nobody can change it`, async () => {
      const k = await accessKeys("testnet", L);
      return [k.length === 0, `${k.length} access keys on ${L}`];
    }],
    ["code", "The ledger runs the reproducible build recorded in the repository", async () => {
      const a = await accountInfo("testnet", L);
      return [a?.code_hash === f.deployment.code_hash_b58, `on chain ${a?.code_hash}; fleet/repro-build.sh ${f.deployment.code_hash_b58}`];
    }],
    ["registered", "The claim was registered before its forward window opened", async () => {
      const c = await view<any>("testnet", L, "get_claim", { claim_id: id });
      return [BigInt(c.registered_at_ns) < BigInt(c.window_start_ns), `registered ${new Date(Number(BigInt(c.registered_at_ns) / 1_000_000n)).toISOString()}, window opens ${new Date(Number(BigInt(c.window_start_ns) / 1_000_000n)).toISOString()}`];
    }],
    ["before-oos", "Every out-of-sample BigQuery query ran after the registration", async () => {
      const c = await view<any>("testnet", L, "get_claim", { claim_id: id });
      const runs = (await (await fetch(`${base}/proof/bq_runs.jsonl`, { cache: "no-store" })).text()).trim().split("\n").map((l) => JSON.parse(l));
      const oos = runs.filter((r: any) => r.start >= "2024-12-30");
      const reg = Number(BigInt(c.registered_at_ns) / 1_000_000n);
      const first = oos.map((r: any) => r.ran_at).sort()[0];
      return [oos.length > 0 && oos.every((r: any) => Date.parse(r.ran_at) > reg), `registered ${new Date(reg).toISOString()}; first out-of-sample query ${first} (data/out/bq_runs.jsonl)`];
    }],
    ["method", "The method document's SHA-256 equals the hash registered on chain", async () => {
      const c = await view<any>("testnet", L, "get_claim", { claim_id: id });
      const h = await sha256Hex(await (await fetch(`${base}/proof/METHOD.md`, { cache: "no-store" })).text());
      return [h === c.method_sha256, `served docs/METHOD.md ${h.slice(0, 16)}...; on chain ${c.method_sha256.slice(0, 16)}...`];
    }],
    ["manifest", "The code manifest's SHA-256 equals the SQL hash registered on chain", async () => {
      const c = await view<any>("testnet", L, "get_claim", { claim_id: id });
      const h = await sha256Hex(await (await fetch(`${base}/proof/CODE_MANIFEST.sha256`, { cache: "no-store" })).text());
      return [h === c.sql_sha256, `served docs/CODE_MANIFEST.sha256 ${h.slice(0, 16)}...; on chain ${c.sql_sha256.slice(0, 16)}...`];
    }],
    ["crank-key", "The crank posts with a function-call key limited to post on the ledger", async () => {
      const keys = await accessKeys("testnet", crank);
      const k = keys.find((x) => x.public_key === f.deployment.crank_post_key);
      const p: any = k?.access_key.permission;
      const ok = !!p?.FunctionCall && p.FunctionCall.receiver_id === L && p.FunctionCall.method_names.length === 1 && p.FunctionCall.method_names[0] === "post";
      return [ok, ok ? `${k!.public_key}: FunctionCall, receiver ${L}, methods [post], allowance ${p.FunctionCall.allowance}` : "post key not found or wider than post"];
    }],
    ["posts", "Every posted observation's output hash matches the committed output file", async () => {
      const obs = await view<any[]>("testnet", L, "observations", { claim_id: id });
      const posted: any[] = f.crank?.posted ?? [];
      if (obs.length === 0) return [true, "no week posted yet; the forward window opens 2026-11-16 and the first post follows its first week"];
      const bad = obs.filter((o) => posted.find((p) => p.period === o.period)?.rows_sha256 !== o.rows_sha256);
      return [bad.length === 0, `${obs.length - bad.length} of ${obs.length} posted hashes match data/crank-last.json`];
    }],
    ["facts", "The numbers on this site come from the committed result files", async () => {
      // Canonical form, as scripts/facts.ts hashes it: numbers to 10 significant digits.
      const raw = await (await fetch(`${base}/proof/results.json`, { cache: "no-store" })).text();
      const h = await sha256Hex(JSON.stringify(JSON.parse(raw), (_k, v) => (typeof v === "number" && Number.isFinite(v) ? Number(v.toPrecision(10)) : v)));
      const want = f.files?.["data/out/results.json"];
      return [!!want && h === want, `served results.json ${h.slice(0, 16)}...; FACTS.json records ${String(want).slice(0, 16)}...`];
    }],
  ];
  const checks: Check[] = defs.map(([cid, claim]) => ({ id: cid, claim, ok: null, detail: "reading" }));
  onUpdate?.([...checks]);
  await Promise.all(defs.map(async ([, , fn], i) => {
    try { const [ok, detail] = await fn(); checks[i] = { ...checks[i], ok, detail }; }
    catch (e) { checks[i] = { ...checks[i], ok: false, detail: `could not read: ${String((e as Error).message ?? e).slice(0, 140)}` }; }
    onUpdate?.([...checks]);
  }));
  return { checks, at: new Date().toISOString() };
}
