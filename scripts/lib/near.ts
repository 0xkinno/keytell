// Shared NEAR helpers for scripts: RPC with failover, keys from ~/.near-credentials, typed calls.
import { Account, JsonRpcProvider, KeyPair, type KeyPairString } from "near-api-js";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const NETWORK = (process.env.NEAR_NETWORK ?? "testnet") as "testnet" | "mainnet";
export const RPC_URLS = (process.env.NEAR_RPC_URLS ??
  (NETWORK === "testnet"
    ? "https://rpc.testnet.fastnear.com,https://test.rpc.fastnear.com,https://rpc.testnet.near.org"
    : "https://free.rpc.fastnear.com,https://rpc.mainnet.fastnear.com,https://rpc.mainnet.near.org")).split(",");

export const TGAS = 1_000_000_000_000n;
export const ONE_YOCTO = 1n;
export const NEAR = 10n ** 24n;
export const milli = (n: number) => (BigInt(Math.round(n * 1_000_000)) * NEAR) / 1_000_000n;

let current = 0;
export function provider(): JsonRpcProvider {
  return new JsonRpcProvider({ url: RPC_URLS[current % RPC_URLS.length] });
}

/** Runs `fn` against each RPC in turn until one answers. */
export async function withFailover<T>(fn: (p: JsonRpcProvider) => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < RPC_URLS.length; i++) {
    try {
      return await fn(provider());
    } catch (e) {
      last = e;
      const msg = String((e as Error)?.message ?? e);
      // Contract panics are answers, not outages.
      if (/panicked|Smart contract|does not exist|ExecutionError|MethodNotFound/i.test(msg)) throw e;
      current++;
    }
  }
  throw last;
}

export async function view<T = unknown>(contractId: string, method: string, args: object = {}, blockId?: string | number): Promise<T> {
  return withFailover(async (p) => {
    const r = await p.callFunction({ contractId, method, args, ...(blockId ? { blockQuery: { blockId } } : {}) } as never);
    return r as T;
  });
}

export function credsDir(): string {
  return join(homedir(), ".near-credentials", NETWORK);
}

export function loadKey(accountId: string): KeyPairString | null {
  if (process.env[`KEY_${accountId.replace(/[^a-z0-9]/gi, "_").toUpperCase()}`]) {
    return process.env[`KEY_${accountId.replace(/[^a-z0-9]/gi, "_").toUpperCase()}`] as KeyPairString;
  }
  const path = join(credsDir(), `${accountId}.json`);
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  return (raw.private_key ?? raw.secret_key) as KeyPairString;
}

export function saveKey(accountId: string, kp: KeyPair) {
  mkdirSync(credsDir(), { recursive: true });
  writeFileSync(
    join(credsDir(), `${accountId}.json`),
    JSON.stringify({ account_id: accountId, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }, null, 2),
    { mode: 0o600 },
  );
}

export function account(accountId: string, key?: KeyPairString): Account {
  const k = key ?? loadKey(accountId);
  if (!k) throw new Error(`no key for ${accountId} in ${credsDir()}`);
  return new Account(accountId, provider(), k);
}

export async function exists(accountId: string): Promise<boolean> {
  try {
    await withFailover((p) => p.viewAccount({ accountId } as never));
    return true;
  } catch {
    return false;
  }
}

export async function balance(accountId: string): Promise<bigint> {
  const a = (await withFailover((p) => p.viewAccount({ accountId } as never))) as unknown as { amount: string | bigint };
  return BigInt(a.amount);
}

export async function accessKeys(accountId: string): Promise<unknown[]> {
  const r = (await withFailover((p) => p.viewAccessKeyList({ accountId } as never))) as { keys: unknown[] };
  return r.keys;
}

export async function codeHash(accountId: string): Promise<string> {
  const a = (await withFailover((p) => p.viewAccount({ accountId } as never))) as { code_hash: string; global_contract_hash?: string };
  return a.code_hash;
}

export interface CallOut {
  hash: string;
  ok: boolean;
  value: unknown;
  logs: string[];
  failure?: string;
  gasBurnt: bigint;
}

/** Calls a method and returns the outcome without throwing on a contract refusal. */
export async function call(signer: Account, contractId: string, methodName: string, args: object, opts: { gasT?: number; deposit?: bigint } = {}): Promise<CallOut> {
  const gas = BigInt(opts.gasT ?? 100) * TGAS;
  let res: any;
  try {
    res = await signer.signAndSendTransaction({
      receiverId: contractId,
      actions: [(await import("near-api-js")).actions.functionCall(methodName, args, gas, opts.deposit ?? 0n)],
      waitUntil: "FINAL",
    } as never);
  } catch (e: any) {
    // near-api-js throws on a failed transaction; the outcome rides along, so keep its hash and reason.
    if (e?.transactionResult) {
      const out = parseOutcome(e.transactionResult);
      return { ...out, ok: false, failure: e.panicMessage ?? out.failure ?? String(e?.message ?? e) };
    }
    const hash = e?.context?.transactionHash ?? e?.transaction_outcome?.id ?? e?.txHash ?? "";
    return { hash, ok: false, value: null, logs: [], failure: String(e?.message ?? e), gasBurnt: 0n };
  }
  return parseOutcome(res);
}

export function parseOutcome(res: any): CallOut {
  const logs: string[] = [];
  let gasBurnt = BigInt(res?.transaction_outcome?.outcome?.gas_burnt ?? 0);
  let failure: string | undefined;
  for (const r of res?.receipts_outcome ?? []) {
    logs.push(...(r.outcome?.logs ?? []));
    gasBurnt += BigInt(r.outcome?.gas_burnt ?? 0);
    const st = r.outcome?.status;
    if (st && st.Failure && !failure) failure = JSON.stringify(st.Failure);
  }
  const st = res?.status ?? {};
  let value: unknown = null;
  if (st.SuccessValue !== undefined && st.SuccessValue !== "") {
    try {
      value = JSON.parse(Buffer.from(st.SuccessValue, "base64").toString());
    } catch {
      value = st.SuccessValue;
    }
  }
  if (st.Failure) failure = JSON.stringify(st.Failure);
  const refused = logs.find((l) => l.startsWith("REFUSED:"));
  if (refused && !failure) failure = refused.slice(8);
  return { hash: res?.transaction?.hash ?? res?.transaction_outcome?.id ?? "", ok: !st.Failure && !refused && value !== false, value, logs, failure, gasBurnt };
}

export function explorerTx(hash: string): string {
  return NETWORK === "testnet" ? `https://testnet.nearblocks.io/txns/${hash}` : `https://nearblocks.io/txns/${hash}`;
}

export function events(logs: string[], standard = "keytell"): any[] {
  return logs
    .filter((l) => l.startsWith("EVENT_JSON:"))
    .map((l) => JSON.parse(l.slice(11)))
    .filter((e) => e.standard === standard);
}

export function refusal(logs: string[], failure?: string): string | null {
  for (const l of logs) if (l.startsWith("REFUSED:")) return JSON.parse(l.slice(8)).code;
  const m = failure?.match(/(E_[A-Z_]+|[A-Z][A-Z_]{4,}[A-Z])/);
  return m ? m[1] : null;
}

export function readDeployment(): any {
  const p = `deployments/${NETWORK}.json`;
  if (!existsSync(p)) throw new Error(`${p} missing: run fleet/deploy-testnet.ts`);
  return JSON.parse(readFileSync(p, "utf8"));
}
