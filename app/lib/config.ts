// Public configuration. Nothing secret lives here or anywhere in the app bundle.
export const REPO = "https://github.com/0xkinno/keytell";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://keytell.vercel.app";
export const LEDGER_NETWORK = "testnet" as const;
export const DATA_NETWORK = "mainnet" as const;
export const RPC = {
  testnet: ["https://rpc.testnet.fastnear.com", "https://test.rpc.fastnear.com", "https://rpc.testnet.near.org"],
  mainnet: ["https://free.rpc.fastnear.com", "https://rpc.mainnet.fastnear.com", "https://rpc.mainnet.near.org"],
};
export const EXPLORER = {
  testnet: (h: string) => `https://testnet.nearblocks.io/txns/${h}`,
  mainnet: (h: string) => `https://nearblocks.io/txns/${h}`,
  accountTestnet: (a: string) => `https://testnet.nearblocks.io/address/${a}`,
  accountMainnet: (a: string) => `https://nearblocks.io/address/${a}`,
};
export const BQ_CONSOLE = (sql: string) => `https://console.cloud.google.com/bigquery?q=${encodeURIComponent(sql)}`;
