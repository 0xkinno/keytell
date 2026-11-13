"use client";
// near-connect wallets. Reading never needs a wallet; only two actions do: signing the analyst memo
// (NEP-413, a signed message, no transaction, no fee) and calling `resolve` on the ledger after the
// window ends.
import { APP_URL, RPC } from "./config";

type Net = "mainnet" | "testnet";
const connectors: Partial<Record<Net, Promise<any>>> = {};

export function getConnector(net: Net): Promise<any> {
  if (typeof window === "undefined") throw new Error("WALLET_BROWSER_ONLY");
  connectors[net] ??= import("@hot-labs/near-connect").then(async ({ NearConnector }) => {
    const c = new NearConnector({
      network: net,
      providers: { [net]: RPC[net] },
      features: net === "testnet" ? { testnet: true } : { mainnet: true },
      footerBranding: { heading: "Keytell", link: APP_URL, linkText: "Count the small keys" },
      autoConnect: true,
    } as never);
    try { await c.whenManifestLoaded; } catch {}
    return c;
  });
  return connectors[net]!;
}

export const MEMO_RECIPIENT = "keytell.memo";

export interface Signed413 { accountId: string; publicKey: string; signature: string; message: string; nonce: string; recipient: string }

function b64(bytes: Uint8Array): string {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

/** Asks the analyst's wallet (mainnet) to sign the memo attestation as a NEP-413 message. */
export async function signMemo(message: string): Promise<Signed413> {
  const c = await getConnector("mainnet");
  const nonce = crypto.getRandomValues(new Uint8Array(32));
  const wallet = await c.wallet();
  const s: any = await wallet.signMessage({ message, recipient: MEMO_RECIPIENT, nonce } as never);
  const sig = typeof s.signature === "string" ? s.signature : b64(s.signature);
  return { accountId: s.accountId, publicKey: s.publicKey, signature: sig, message, nonce: b64(nonce), recipient: MEMO_RECIPIENT };
}

export async function connect(net: Net): Promise<string | null> {
  const c = await getConnector(net);
  await c.connect();
  const { accounts } = await c.getConnectedWallet();
  return accounts?.[0]?.accountId ?? null;
}

/** Calls resolve on the ledger from the connected testnet wallet. */
export async function resolveClaim(ledger: string, claimId: string): Promise<any> {
  const c = await getConnector("testnet");
  const { wallet } = await c.getConnectedWallet();
  return wallet.signAndSendTransaction({
    receiverId: ledger,
    actions: [{ type: "FunctionCall", params: { methodName: "resolve", args: { claim_id: claimId }, gas: "50000000000000", deposit: "0" } }],
  } as never);
}
