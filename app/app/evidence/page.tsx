import type { Metadata } from "next";
import Link from "next/link";
import { Plate } from "@/components/Plate";
import { LineChart } from "@/components/LineChart";
import { Bars } from "@/components/Bars";
import weeklyData from "@/lib/generated/weekly.json";
import facts from "@/lib/generated/facts.json";
import evidence from "@/lib/generated/evidence.json";
import { pct, compact, num } from "@/lib/format";

export const metadata: Metadata = { title: "The evidence for · Keytell" };

const COLORS = { fc: "#d27a2c", daa: "#5f7d95", price: "#a98b54", usdc: "#14181b", tx: "#a7b0b5" };

function indexed(vals: (number | null)[], baseIdx: number) {
  const base = vals[baseIdx];
  return vals.map((v) => (v === null || !base ? null : (v / base) * 100));
}

export default function Evidence() {
  const f = facts as any;
  const ev = evidence as any;
  const weekly = (weeklyData as any[]).filter((w) => w.window !== "forward");
  const scored = weekly.filter((w) => w.monday >= "2023-09-04");
  const dates = scored.map((w) => w.monday);
  const base = Math.max(0, scored.findIndex((w) => w.monday === f.windows.in_sample[0]));
  const rules = [
    { date: f.windows.in_sample[0], label: "in-sample starts" },
    { date: f.windows.out_of_sample[0], label: "out-of-sample starts" },
  ];
  const b = f.backtest;
  const gains = b?.oos_gain ?? {};
  const lags = (ev?.lags ?? []) as any[];
  const corr = (ev?.correlations ?? []) as any[];
  const oos = (ev?.oos_errors ?? []) as any[];
  let cumD = 0, cumP = 0;
  const cumDaa = oos.map((r) => (r.e_fc_signed_tx && r.e_daa ? (cumD += Number(r.e_fc_signed_tx) ** 2 - Number(r.e_daa) ** 2) : null));
  const cumPrice = oos.map((r) => (r.e_fc_signed_tx && r.e_price ? (cumP += Number(r.e_fc_signed_tx) ** 2 - Number(r.e_price) ** 2) : null));
  const allWeeks = weekly.filter((w) => w.fc_share !== null);

  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 sm:px-6">
      <p className="eyebrow">Brief 01 · The case for</p>
      <h1 className="display mt-3 max-w-4xl text-[44px] sm:text-[64px]">Do small keys move before USDC does?</h1>
      <p className="mt-5 max-w-3xl text-[18px] leading-relaxed text-[color:var(--ink-2)]">Each brief below asks one question, answers it in one sentence generated from the results file, and shows the exact query, its bytes scanned and its dates. The pass rule was registered on chain first; the <Link className="ulink" href="/against">case against</Link> is published with the same weight.</p>
      <p className={`display mt-6 text-[28px] ${b?.passed ? "text-[color:var(--verdigris-ink)]" : "text-[color:var(--oxide-ink)]"}`}>{b?.verdict ?? "The out-of-sample run has not finished."}</p>

      <div className="mt-10 space-y-8">
        <Plate n="1.1" side="for" question="Does function-call activity rise before USDC volume does?" sentence={f.sentences?.verdict ?? null}
          source={`BigQuery crypto_near_mainnet_us (transactions, ft_events) through ${f.data.census_last_day}; FC share from the keyless block sample; price from Coin Metrics. Indexed to 100 on ${f.windows.in_sample[0]}, log scale.`}
          sql={[{ file: "sql/04_daa.sql" }, { file: "sql/05_usdc_volume.sql" }]} code={[{ label: "Sampler", path: "scripts/sample-chain.ts" }, { label: "Test", path: "analysis/method.py" }]}>
          <LineChart title="Weekly FC-signed transactions, DAA, price and USDC volume, indexed" dates={dates} logY rules={rules}
            yFormat="compact" valueFormat="fixed0"
            series={[
              { key: "usdc", label: "USDC volume", color: COLORS.usdc, values: indexed(scored.map((w) => w.usdc), base), width: 2.4 },
              { key: "fc", label: "FC-signed tx", color: COLORS.fc, values: indexed(scored.map((w) => w.fc_tx), base), width: 2.6 },
              { key: "daa", label: "DAA", color: COLORS.daa, values: indexed(scored.map((w) => w.daa), base), dash: "5 4" },
              { key: "price", label: "NEAR price", color: COLORS.price, values: indexed(scored.map((w) => w.price), base), dash: "2 3" },
            ]} />
        </Plate>

        <Plate n="1.2" side="for" question="How much does each signal improve the one-step forecast?" sentence={f.sentences?.vs_baselines ?? null}
          source={`Expanding-window one-step forecasts over ${b?.oos_weeks_scored ?? "n/a"} out-of-sample weeks (${f.windows.out_of_sample.join(" to ")}); gain = 1 - SSE(model)/SSE(AR(2)); each candidate at its best in-sample lag. data/out/results.json`}
          code={[{ label: "Test", path: "analysis/method.py" }, { label: "Errors", path: "data/out/oos_errors.csv" }]}>
          <Bars title="Out-of-sample forecast gain over AR(2) by candidate signal" rows={[
            { label: "FC-signed transactions", note: `lag ${b?.best_in_sample_lag?.fc_signed_tx ?? "n/a"} wk, headline`, value: gains.fc_signed_tx ?? null, color: COLORS.fc },
            { label: "FC share", note: `lag ${b?.best_in_sample_lag?.fc_share ?? "n/a"} wk`, value: gains.fc_share ?? null, color: "#e7a96a" },
            { label: "Daily active accounts", note: `lag ${b?.best_in_sample_lag?.daa ?? "n/a"} wk, baseline`, value: gains.daa ?? null, color: COLORS.daa },
            { label: "Transaction count", note: `lag ${b?.best_in_sample_lag?.tx_count ?? "n/a"} wk`, value: gains.tx_count ?? null, color: COLORS.tx },
            { label: "NEAR price", note: `lag ${b?.best_in_sample_lag?.price ?? "n/a"} wk, baseline`, value: gains.price ?? null, color: COLORS.price },
          ]} />
        </Plate>

        <Plate n="1.3" question="Where did it win and where did it lose?" sentence="Running total of the per-week difference in squared forecast error. A line that falls means function-call activity forecast better than the baseline over those weeks; a line that rises means it did worse. Losses are not smoothed away."
          source="data/out/oos_errors.csv: per-week one-step errors for each model, out-of-sample weeks only." code={[{ label: "Errors", path: "data/out/oos_errors.csv" }]}>
          {oos.length ? (
            <LineChart title="Cumulative squared-error difference: FC-signed model minus baselines" dates={oos.map((r) => r.monday)} yFormat="fixed2" valueFormat="fixed3"
              series={[{ key: "d", label: "FC minus DAA", color: COLORS.daa, values: cumDaa }, { key: "p", label: "FC minus price", color: COLORS.price, values: cumPrice }]} />
          ) : <p className="text-[15px] text-[color:var(--ink-2)]">Not computed yet.</p>}
        </Plate>

        <Plate n="1.4" question="Which lag did the in-sample window choose, and how sure was it?" sentence="The lag for each signal was chosen on in-sample weeks only, as the one with the largest reduction in squared error over AR(2). Out-of-sample weeks never touched this choice."
          source={`data/out/lags.csv, in-sample ${f.windows.in_sample.join(" to ")}.`} code={[{ label: "Lags", path: "data/out/lags.csv" }]}>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
            <table className="table-k">
              <thead><tr><th>Signal</th>{[1, 2, 3, 4, 5, 6, 7, 8].map((k) => <th key={k}>lag {k}</th>)}</tr></thead>
              <tbody>
                {["fc_signed_tx", "fc_share", "daa", "tx_count", "price"].map((c) => (
                  <tr key={c}><td className="mono">{c}</td>{[1, 2, 3, 4, 5, 6, 7, 8].map((k) => {
                    const r = lags.find((x) => x.candidate === c && Number(x.lag) === k);
                    const best = b?.best_in_sample_lag?.[c] === k;
                    return <td key={k} className={`mono ${best ? "font-bold text-[color:var(--copper-ink)]" : ""}`}>{r?.in_gain ? pct(Number(r.in_gain)) : "n/a"}</td>;
                  })}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </Plate>

        <Plate n="1.5" question="Do the signals and USDC volume move together, lag by lag?" sentence="Lagged Spearman rank correlations between each signal's log change k weeks earlier and the log change in USDC volume, with moving-block bootstrap 95 percent intervals. Descriptive only; the pass rule uses forecast error."
          source="data/out/correlations.csv" code={[{ label: "Correlations", path: "data/out/correlations.csv" }]}>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
            <table className="table-k">
              <thead><tr><th>Signal</th><th>Window</th>{[1, 2, 3, 4, 5, 6, 7, 8].map((k) => <th key={k}>k={k}</th>)}</tr></thead>
              <tbody>
                {["fc_signed_tx", "daa", "price"].flatMap((c) => ["in_sample", "out_of_sample"].map((win) => (
                  <tr key={c + win}><td className="mono">{c}</td><td className="mono">{win.replace(/_/g, " ")}</td>{[1, 2, 3, 4, 5, 6, 7, 8].map((k) => {
                    const r = corr.find((x) => x.candidate === c && x.window === win && Number(x.lag) === k);
                    return <td key={k} className="mono text-[12.5px]">{r && r.spearman !== "" ? `${Number(r.spearman).toFixed(2)} [${Number(r.ci_lo).toFixed(2)}, ${Number(r.ci_hi).toFixed(2)}]` : "n/a"}</td>;
                  })}</tr>
                )))}
              </tbody>
            </table>
          </div>
        </Plate>

        <Plate id="share" n="1.6" question="What share of NEAR transactions do function-call keys sign?" sentence={f.sentences?.latest ?? null}
          source={`Keyless block sample: ${num(f.data.blocks_sampled)} blocks, ${num(f.data.transactions_classified)} transactions classified at signing time, ${num(f.data.archival_lookups)} archival key lookups. Wilson 95 percent intervals (ignore block clustering, so a lower bound on width).`}
          code={[{ label: "Sampler", path: "scripts/sample-chain.ts" }, { label: "Classifier", path: "scripts/lib/classify.ts" }]}>
          <LineChart title="Weekly share of sampled transactions signed by a function-call key, with interval" dates={allWeeks.map((w) => w.monday)} rules={rules} yFormat="pct" valueFormat="pct"
            series={[
              { key: "hi", label: "upper 95%", color: "#e7c9a5", values: allWeeks.map((w) => w.fc_share_hi), width: 1 },
              { key: "fc", label: "FC share", color: COLORS.fc, values: allWeeks.map((w) => w.fc_share), width: 2.4 },
              { key: "lo", label: "lower 95%", color: "#e7c9a5", values: allWeeks.map((w) => w.fc_share_lo), width: 1 },
              { key: "fco", label: "FUNCTION_CALL only", color: "#9a5212", values: allWeeks.map((w) => w.fc_only_share), dash: "4 3", width: 1.4 },
            ]} />
        </Plate>

        <Plate n="1.7" question="Can a sample of 60 blocks a week be trusted?" sentence={f.sentences?.sample_check ?? null}
          source="Sampled estimate: transactions in 60 random blocks scaled by the week's height range. Census: BigQuery transactions table (sql/04)." sql={[{ file: "sql/04_daa.sql" }]}>
          <LineChart title="Weekly transactions: sample estimate against the BigQuery census" dates={allWeeks.map((w) => w.monday)} yFormat="compact"
            series={[{ key: "c", label: "Census", color: COLORS.usdc, values: allWeeks.map((w) => w.census_tx) }, { key: "s", label: "Sample estimate", color: COLORS.fc, values: allWeeks.map((w) => w.tx_sampled_estimate), dash: "4 3" }]} />
        </Plate>
      </div>
    </div>
  );
}
