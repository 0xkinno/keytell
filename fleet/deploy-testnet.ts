// Stands up the Keytell ledger on testnet under ROOT (default keytell.testnet):
//   ledger.ROOT  thesis_ledger, initialised with publisher = ROOT and crank = crank.ROOT, then sealed
//                (its only full-access key deleted, so nobody can upgrade it or edit a claim)
//   crank.ROOT   holds a function-call key limited to `post` on the ledger with a 0.25 NEAR gas
//                allowance; scripts/crank.ts signs with that key only
// Idempotent: each step checks chain state first. Keys go to ~/.near-credentials/testnet only.
// Writes deployments/testnet.json.
import { KeyPair, actions } from "near-api-js";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import bs58 from "bs58";
import { account, exists, loadKey, saveKey, view, accessKeys, codeHash, milli, explorerTx, credsDir } from "../scripts/lib/near.ts";
import { join } from "node:path";

const ROOT = process.env.ROOT_ACCOUNT ?? "keytell.testnet";
const WASM = readFileSync("target/near/thesis_ledger/thesis_ledger.wasm");
const sha256b58 = (b: Buffer) => bs58.encode(createHash("sha256").update(b).digest());
const sha256hex = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const log = (...a: unknown[]) => console.log(...a);
const prev = existsSync("deployments/testnet.json") ? JSON.parse(readFileSync("deployments/testnet.json", "utf8")) : {};
const txs: Record<string, string> = { ...(prev.txs ?? {}) };
const hashOf = (r: any) => r?.transaction?.hash ?? r?.transaction_outcome?.id ?? "";

const root = account(ROOT);

async function ensure(label: string, near: number) {
  const acc = `${label}.${ROOT}`;
  if (await exists(acc)) {
    log(`  reuse ${acc}`);
    return acc;
  }
  const kp = KeyPair.fromRandom("ed25519");
  const r = await root.createSubAccount({ accountOrPrefix: acc, publicKey: kp.getPublicKey(), nearToTransfer: milli(near) } as never);
  txs[`create_${label}`] = hashOf(r);
  saveKey(acc, kp);
  log(`  created ${acc} with ${near} NEAR`);
  return acc;
}

async function main() {
  log(`== accounts under ${ROOT} ==`);
  const ledgerId = await ensure("ledger", 3);
  const crankId = await ensure("crank", 1);

  log("== deploy and initialise the ledger in one transaction ==");
  let initialised = false;
  try { await view(ledgerId, "roles"); initialised = true; } catch {}
  if (!initialised) {
    const ledger = account(ledgerId);
    const r: any = await ledger.signAndSendTransaction({
      receiverId: ledgerId,
      actions: [actions.deployContract(WASM), actions.functionCall("new", { publisher: ROOT, crank: crankId }, 30_000_000_000_000n, 0n)],
      waitUntil: "FINAL",
    } as never);
    txs.deploy_and_init = hashOf(r);
    log(`  deployed and initialised ${explorerTx(txs.deploy_and_init)}`);
  } else log("  already initialised");

  log("== crank function-call key: post only, 0.25 NEAR allowance ==");
  const fcPath = join(credsDir(), `${crankId}.post-key.json`);
  let fcPub: string;
  if (!existsSync(fcPath)) {
    const kp = KeyPair.fromRandom("ed25519");
    const crank = account(crankId);
    const r: any = await crank.addFunctionCallAccessKey({ publicKey: kp.getPublicKey(), contractId: ledgerId, methodNames: ["post"], allowance: milli(0.25) } as never);
    txs.crank_fc_key = hashOf(r);
    writeFileSync(fcPath, JSON.stringify({ account_id: crankId, public_key: kp.getPublicKey().toString(), private_key: kp.toString() }, null, 2), { mode: 0o600 });
    fcPub = kp.getPublicKey().toString();
    log(`  added ${fcPub}`);
  } else {
    fcPub = JSON.parse(readFileSync(fcPath, "utf8")).public_key;
    log(`  reuse ${fcPub}`);
  }

  log("== seal: delete every key on the ledger ==");
  if (process.env.SEAL !== "0") {
    const keys: any[] = await accessKeys(ledgerId);
    if (keys.length && loadKey(ledgerId)) {
      const ledger = account(ledgerId);
      for (const k of keys) {
        const r: any = await ledger.deleteKey(k.public_key);
        txs.seal_ledger = hashOf(r);
        log(`  deleted ${k.public_key} ${explorerTx(txs.seal_ledger)}`);
      }
    }
  }

  const crankKeys: any[] = await accessKeys(crankId);
  const out = {
    network: "testnet",
    root: ROOT,
    publisher: ROOT,
    ledger: ledgerId,
    crank: crankId,
    crank_post_key: fcPub,
    crank_post_key_permission: (crankKeys.find((k: any) => k.public_key === fcPub)?.access_key?.permission) ?? null,
    code_hashes: {
      thesis_ledger: { wasm_sha256_b58: sha256b58(WASM), wasm_sha256_hex: sha256hex(WASM), on_chain: await codeHash(ledgerId) },
    },
    access_keys: { ledger: (await accessKeys(ledgerId)).length },
    txs,
    deployed_at: prev.deployed_at ?? new Date().toISOString(),
  };
  mkdirSync("deployments", { recursive: true });
  writeFileSync("deployments/testnet.json", JSON.stringify(out, null, 2) + "\n");
  log(JSON.stringify(out, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
