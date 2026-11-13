// Browser and server RPC helpers: FastNEAR first, 5 s timeout per endpoint, failover down the list.
import { RPC } from "./config";

type Net = keyof typeof RPC;

export class ChainAnswer extends Error {}

export async function rpc<T = any>(net: Net, method: string, params: unknown, timeoutMs = 5000): Promise<T> {
  let last: unknown;
  for (const url of RPC[net]) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "keytell", method, params }),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
      if (r.status === 429 || r.status >= 500) throw new Error(`${url} ${r.status}`);
      const j = await r.json();
      if (j.error) throw new ChainAnswer(j.error?.cause?.name ?? j.error?.name ?? JSON.stringify(j.error));
      if (j.result?.error) throw new ChainAnswer(String(j.result.error));
      return j.result as T;
    } catch (e) {
      last = e;
      if (e instanceof ChainAnswer) throw e;
    }
  }
  throw last;
}

const b64 = (s: string) => (typeof btoa === "function" ? btoa(s) : Buffer.from(s).toString("base64"));

export async function view<T = any>(net: Net, contract: string, method: string, args: object = {}): Promise<T> {
  const r = await rpc<any>(net, "query", { request_type: "call_function", finality: "final", account_id: contract, method_name: method, args_base64: b64(JSON.stringify(args)) });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result))) as T;
}

export interface AccessKeyRow {
  public_key: string;
  access_key: { nonce: number; permission: "FullAccess" | { FunctionCall: { receiver_id: string; method_names: string[]; allowance: string | null } } };
}

export async function accessKeys(net: Net, account: string): Promise<AccessKeyRow[]> {
  const r = await rpc<any>(net, "query", { request_type: "view_access_key_list", finality: "final", account_id: account });
  return r.keys;
}

export async function accountInfo(net: Net, account: string): Promise<{ amount: string; code_hash: string; storage_usage: number } | null> {
  try {
    return await rpc<any>(net, "query", { request_type: "view_account", finality: "final", account_id: account });
  } catch (e) {
    if (e instanceof ChainAnswer) return null;
    throw e;
  }
}

export async function latestBlock(net: Net): Promise<{ height: number; timestamp: string }> {
  const r = await rpc<any>(net, "block", { finality: "final" });
  return { height: r.header.height, timestamp: String(r.header.timestamp) };
}
