// Measures the cost of one forward observation from chain: the gas and NEAR burnt by the control
// `post` the crank sent in the break campaign (data/break.json). Writes data/cost_per_observation.json.
import { readFileSync, writeFileSync } from "node:fs";

const brk = JSON.parse(readFileSync("data/break.json", "utf8"));
const post = brk.results.find((r: any) => r.method === "post" && r.expected === "OK");
const res = await fetch("https://rpc.testnet.fastnear.com", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "EXPERIMENTAL_tx_status", params: { tx_hash: post.hash, sender_account_id: post.signer, wait_until: "FINAL" } }),
}).then((r) => r.json());
const o = res.result;
const outcomes = [o.transaction_outcome, ...o.receipts_outcome];
const gas = outcomes.reduce((a: bigint, x: any) => a + BigInt(x.outcome.gas_burnt), 0n);
const yocto = outcomes.reduce((a: bigint, x: any) => a + BigInt(x.outcome.tokens_burnt), 0n);
const out = { tx: post.hash, signer: post.signer, method: "post", gas_burnt: gas.toString(), tgas: Number(gas) / 1e12, near_burnt: Number(yocto) / 1e24, measured_at: new Date().toISOString(), source: "EXPERIMENTAL_tx_status on rpc.testnet.fastnear.com" };
writeFileSync("data/cost_per_observation.json", JSON.stringify(out, null, 2) + "\n");
console.log(out);
