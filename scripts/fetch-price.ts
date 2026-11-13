// Daily NEAR/USD reference price, cached to data/raw/price.csv with the fetch date and a sha256.
// Source: Coin Metrics Community API (free, no key), metric PriceUSD. CoinGecko's public API was the
// planned source, but it now limits public callers to the last 365 days (error 10012), which cannot
// cover the 2022 to 2024 fitting window. Price is a baseline only.
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";

const START = process.env.PRICE_START ?? "2021-12-01";
const base = "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics";

async function main() {
  const rows: [string, string][] = [];
  let url: string | null = `${base}?assets=near&metrics=PriceUSD&frequency=1d&start_time=${START}&page_size=10000`;
  while (url) {
    const r = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!r.ok) throw new Error(`Coin Metrics ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j: any = await r.json();
    for (const d of j.data ?? []) if (d.PriceUSD) rows.push([d.time.slice(0, 10), d.PriceUSD]);
    url = j.next_page_url ?? null;
  }
  const body = "date,price_usd\n" + rows.map((r) => r.join(",")).join("\n") + "\n";
  mkdirSync("data/raw", { recursive: true });
  writeFileSync("data/raw/price.csv", body);
  const meta = {
    source: "Coin Metrics Community API, asset near, metric PriceUSD, frequency 1d",
    url: `${base}?assets=near&metrics=PriceUSD&frequency=1d&start_time=${START}`,
    licence: "Coin Metrics Community Data, free for non-commercial use with attribution",
    fetched_at: new Date().toISOString(),
    first: rows[0]?.[0], last: rows.at(-1)?.[0], rows: rows.length,
    sha256: createHash("sha256").update(body).digest("hex"),
  };
  writeFileSync("data/raw/price.meta.json", JSON.stringify(meta, null, 2) + "\n");
  console.log(`price: ${rows.length} days, ${meta.first} to ${meta.last}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
