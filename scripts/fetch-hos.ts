// House of Stake leased names on mainnet (a small, honest side series; Part 3.4 of the plan). Pages
// nft_tokens on registry.hos (free reads), and for each leased name reads its access keys and its
// wallet extensions (w_extensions). Writes data/raw/hos_names.csv and data/raw/hos.meta.json.
// An extension other than the name's holder and House of Stake's default `ext.hos` is a third party the
// holder let act for the name: the account-level cousin of a function-call key.
import { writeFileSync } from "node:fs";

const RPC = ["https://free.rpc.fastnear.com", "https://rpc.mainnet.fastnear.com"];
async function call(body: object) {
  for (const url of RPC) {
    try {
      const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, ...body }) }).then((x) => x.json());
      if (r.result) return r.result;
    } catch {}
  }
  throw new Error(`rpc failed: ${JSON.stringify(body).slice(0, 120)}`);
}
const view = async (account_id: string, method_name: string, args: object = {}) => {
  const r = await call({ method: "query", params: { request_type: "call_function", finality: "final", account_id, method_name, args_base64: Buffer.from(JSON.stringify(args)).toString("base64") } });
  if (r.error) throw new Error(r.error);
  return JSON.parse(Buffer.from(r.result).toString());
};

const total = Number(await view("registry.hos", "nft_total_supply"));
const tokens: any[] = [];
for (let i = 0; i < total; i += 50) tokens.push(...(await view("registry.hos", "nft_tokens", { from_index: String(i), limit: 50 })));

const rows: string[] = ["name,holder,rented_at,expires_at,access_keys,fc_keys,extensions,third_party_extensions"];
let keyless = 0, withThird = 0;
for (const t of tokens) {
  const extra = JSON.parse(t.metadata?.extra ?? "{}");
  const iso = (ns?: string) => (ns ? new Date(Number(BigInt(ns) / 1_000_000n)).toISOString() : "");
  const keys = await call({ method: "query", params: { request_type: "view_access_key_list", finality: "final", account_id: t.token_id } }).catch(() => ({ keys: [] }));
  const list = keys.keys ?? [];
  const fc = list.filter((k: any) => k.access_key?.permission?.FunctionCall).length;
  const ext: string[] = await view(t.token_id, "w_extensions").catch(() => []);
  const third = ext.filter((e) => e !== t.owner_id && e !== "ext.hos");
  if (list.length === 0) keyless++;
  if (third.length) withThird++;
  rows.push([t.token_id, t.owner_id, iso(extra.rented_at), iso(extra.expires_at), list.length, fc, ext.join(" "), third.join(" ")].join(","));
}
writeFileSync("data/raw/hos_names.csv", rows.join("\n") + "\n");
const byDay: Record<string, number> = {};
for (const r of rows.slice(1)) { const d = r.split(",")[2].slice(0, 10); byDay[d] = (byDay[d] ?? 0) + 1; }
const meta = { fetched_at: new Date().toISOString(), registry: "registry.hos", names: tokens.length, keyless_names: keyless, names_with_third_party_extension: withThird, first_lease: Object.keys(byDay).sort()[0], last_lease: Object.keys(byDay).sort().at(-1), leases_by_day: byDay };
writeFileSync("data/raw/hos.meta.json", JSON.stringify(meta, null, 2) + "\n");
console.log(JSON.stringify({ ...meta, leases_by_day: `${Object.keys(byDay).length} days` }));
