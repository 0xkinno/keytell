import type { Metadata } from "next";
import { Plate } from "@/components/Plate";
import { Histogram } from "@/components/Bars";
import facts from "@/lib/generated/facts.json";
import evidence from "@/lib/generated/evidence.json";
import receivers from "@/lib/generated/receivers.json";
import episodes from "@/lib/generated/episodes.json";
import { pct, num } from "@/lib/format";

export const metadata: Metadata = { title: "The evidence against · Keytell" };

const LABELS: Record<string, string> = {
  concentration_ex_top10_scopes: "Without the 10 most common function-call scopes",
  concentration_ex_top10_signers: "Without the 10 busiest function-call signers",
  relayers_fc_only: "FUNCTION_CALL only (meta transactions dropped from FC)",
  relayers_all_delegated_as_fc: "Every meta transaction counted as FC",
  relayers_delegated_excluded: "Meta transactions removed from both sides",
  unknown_all_fc: "Every unknown key counted as FC",
  unknown_all_full: "Every unknown key counted as full access",
  episodes_excluded: "Flagged episode weeks left out of the scoring",
};

function Verdict({ ok }: { ok: boolean | undefined }) {
  if (ok === undefined) return <span className="mono text-[color:var(--ink-2)]">n/a</span>;
  return <span className={`tag ${ok ? "tag-for" : "tag-against"}`}>{ok ? "still passes" : "would fail"}</span>;
}

export default function Against() {
  const f = facts as any;
  const ev = evidence as any;
  const c = f.controls;
  const dirs = (ev?.directions ?? []) as any[];
  const list = (cand: string, kind: string) => dirs.filter((d) => d.candidate === cand && d.kind === kind).map((d) => d.monday);
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 sm:px-6">
      <p className="eyebrow">Brief 02 · The case against</p>
      <h1 className="display mt-3 max-w-4xl text-[44px] sm:text-[64px]">Is it a few apps, a relayer, or luck?</h1>
      <p className="mt-5 max-w-3xl text-[18px] leading-relaxed text-[color:var(--ink-2)]">Every control here was written into the registered method before the out-of-sample data was read. Each reruns the same comparison with one assumption changed. If a control breaks the result, it says so in red.</p>

      <div className="mt-10 space-y-8">
        <Plate n="2.1" side="against" question="Does the result survive every control?" sentence={c ? `${Object.values(c.variants).filter((v: any) => v.would_pass).length} of ${Object.keys(c.variants).length} reruns would still pass the registered rule.` : "Controls have not been computed yet."}
          source="data/out/controls.json; each rerun keeps the headline's in-sample lag and the baselines' lags." code={[{ label: "Controls", path: "analysis/controls.py" }]}>
          <div className="overflow-x-auto">
            <table className="table-k">
              <thead><tr><th>Rerun</th><th>FC gain</th><th>DAA gain</th><th>Price gain</th><th>Weeks</th><th>Pass rule</th></tr></thead>
              <tbody>
                {c ? Object.entries(c.variants).map(([k, v]: [string, any]) => (
                  <tr key={k}><td>{LABELS[k] ?? k}</td><td className="mono">{pct(v.headline_gain)}</td><td className="mono">{pct(v.daa_gain)}</td><td className="mono">{pct(v.price_gain)}</td><td className="mono">{v.weeks}</td><td><Verdict ok={v.would_pass} /></td></tr>
                )) : <tr><td colSpan={6}>Not computed yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </Plate>

        <Plate n="2.2" side="against" question="Could the timing be luck?" sentence={f.sentences?.placebo ?? null}
          source={`Placebo: the FC log-change series circularly shifted by ${c?.placebo?.reps ?? 1000} random offsets of at least 8 weeks (seed 20261114), out-of-sample gain recomputed each time. data/out/placebo.csv`} code={[{ label: "Placebo", path: "data/out/placebo.csv" }]}>
          <Histogram title="Out-of-sample gains of timing placebos, with the real gain" values={ev?.placebo ?? []} real={c?.placebo?.real_oos_gain ?? null} p95={c?.placebo?.placebo_p95 ?? null} />
        </Plate>

        <Plate n="2.3" side="against" question="Is function-call activity just a few apps?" sentence={f.sentences?.concentration ?? null}
          source="data/out/fc_receivers.csv: the receiver contract each function-call key was scoped to, across every sampled function-call transaction." code={[{ label: "Scopes", path: "data/out/fc_receivers.csv" }]}>
          <div className="overflow-x-auto">
            <table className="table-k">
              <thead><tr><th>#</th><th>Key scoped to</th><th>Sampled FC tx</th><th>Share of FC</th><th>Weeks seen</th></tr></thead>
              <tbody>
                {(receivers as any[]).slice(0, 15).map((r, i) => (
                  <tr key={r.scope}><td className="mono">{i + 1}</td><td className="mono break-all"><a className="ulink" href={`https://nearblocks.io/address/${r.scope}`} target="_blank" rel="noreferrer">{r.scope}</a></td><td className="mono">{num(r.sampled_fc_txs)}</td><td className="mono">{pct(r.share_of_fc)}</td><td className="mono">{r.weeks_seen}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Plate>

        <Plate n="2.4" side="against" question="When was the signal wrong?" sentence={f.sentences?.directions ?? null}
          source="data/out/directions.csv: out-of-sample weeks; a signal or the outcome 'rose' when its log change beat its in-sample 67th percentile. The DAA rows are the committee that only had a DAA chart." code={[{ label: "Directions", path: "data/out/directions.csv" }]}>
          <div className="grid gap-5 md:grid-cols-3">
            {[["fc_signed_tx", "Function-call keys"], ["daa", "DAA only"], ["price", "Price only"]].map(([k, l]) => (
              <div key={k} className="rounded-lg border border-[color:var(--hair)] p-4">
                <p className="font-semibold">{l}</p>
                <p className="mono mt-2 text-[12.5px] text-[color:var(--verdigris-ink)]">Hits ({list(k, "hit").length}): {list(k, "hit").join(", ") || "none"}</p>
                <p className="mono mt-2 text-[12.5px] text-[color:var(--oxide-ink)]">False alarms ({list(k, "false_alarm").length}): {list(k, "false_alarm").join(", ") || "none"}</p>
                <p className="mono mt-2 text-[12.5px] text-[color:var(--oxide-ink)]">Misses ({list(k, "miss").length}): {list(k, "miss").join(", ") || "none"}</p>
              </div>
            ))}
          </div>
        </Plate>

        <Plate n="2.5" side="against" question="Which weeks look like bots or farming?" sentence={`${(episodes as any[]).length} weeks are flagged: one function-call scope carried at least half the week's sampled FC transactions, or DAA reached three times its trailing 8-week median. No curated airdrop list is used, because none could be sourced for every week.`}
          source="data/out/episodes.csv" code={[{ label: "Episodes", path: "data/out/episodes.csv" }]}>
          <div className="overflow-x-auto">
            <table className="table-k">
              <thead><tr><th>Week</th><th>Top scope share of FC</th><th>DAA</th><th>Flag</th></tr></thead>
              <tbody>
                {(episodes as any[]).map((e) => (
                  <tr key={e.week}><td className="mono">{e.week}</td><td className="mono">{e.top_scope_share_of_fc ? pct(Number(e.top_scope_share_of_fc)) : "n/a"}</td><td className="mono">{e.daa ? num(Number(e.daa)) : "n/a"}</td><td className="mono">{[e.flag_top_scope === "True" ? "one scope" : "", e.flag_daa_spike === "True" ? "DAA spike" : ""].filter(Boolean).join(", ")}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </Plate>

        <Plate n="2.6" side="against" question="What can this data not tell you?" sentence={null} source="docs/METHOD.md sections 3 to 6; docs/RISK.md.">
          <ul className="list-disc space-y-2 pl-5 text-[16px] leading-relaxed">
            <li>The key mix is a sample of {num(f.data.transactions_classified)} transactions, not a census. Weekly shares carry intervals; the full ADD_KEY ledger would cost roughly 20 TB to scan.</li>
            <li>USDC volume before {f.windows.in_sample[0]} is not in the census (bridged USDC.e logged no NEP-141 events until 2023-10-11), so those weeks are shown but not scored.</li>
            <li>Custodial apps sign with function-call keys for their users; function-call activity can measure a few large apps. Brief 2.3 shows how concentrated it is.</li>
            <li>The forward claim resolves on numbers the crank posts. Trust in them comes from <span className="mono">make verify</span>, which recomputes each from public data and compares hashes, not from the contract.</li>
            <li>Retention (signers who return within 4 to 8 weeks) and NEAR Intents volume are not computable within this build: the first is above the scan budget, the second needs a partner key the build did not have.</li>
            <li>Largest weekly share of keys nobody could read: {pct(f.data.max_unknown_share)}{f.data.weeks_unknown_over_5pct?.length ? `; above 5 percent in ${f.data.weeks_unknown_over_5pct.join(", ")}` : "; never above 5 percent in a scored week"}.</li>
          </ul>
        </Plate>
      </div>
    </div>
  );
}
