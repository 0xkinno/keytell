import type { Metadata } from "next";
import facts from "@/lib/generated/facts.json";
import { REPO } from "@/lib/config";

export const metadata: Metadata = { title: "Rerun every number · Keytell" };

const STEPS = [
  { cmd: `git clone ${REPO} && cd keytell && npm ci && make verify`, needs: "Node 22 and Python 3.12. No account, no key.", expect: "Rebuilds the weekly series, the test, the controls and FACTS.json from the committed data, then checks the posted hashes and the registered method and code hashes against the chain. Ends with PASS lines and exits 0; any drift fails it." },
  { cmd: "make sample FROM=2025-01-06 TO=2025-01-06", needs: "Network only. No account, no key.", expect: "Draws the same 60 blocks and the same 200 transactions for that week (seeded) from the FastNEAR block archive and classifies each signing key over public RPC. The new CSV hashes the same as the committed one unless a key was deleted since; the difference is reported." },
  { cmd: "make rebuild", needs: "BigQuery credentials (GOOGLE_APPLICATION_CREDENTIALS and BQ_PROJECT) for the census; without them it reuses committed data/out and says so.", expect: "Reruns sql/04 and sql/05 behind a dry-run gate and a byte cap, then the analysis and FACTS." },
];

export default function Rerun() {
  const f = facts as any;
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <p className="eyebrow">Brief 06 · For skeptics</p>
      <h1 className="display mt-3 text-[44px] sm:text-[64px]">Rebuild every number.</h1>
      <p className="mt-5 max-w-3xl text-[18px] leading-relaxed text-[color:var(--ink-2)]">Three commands. The first needs nothing but the repository. Every chart on this site is drawn from files these commands produce.</p>
      <ol className="mt-10 space-y-6">
        {STEPS.map((s, i) => (
          <li key={s.cmd} className="plate p-6">
            <p className="mono text-[12px] tracking-[0.14em] text-[color:var(--copper-ink)]">STEP {i + 1}</p>
            <pre className="sql mt-3">{s.cmd}</pre>
            <p className="mt-3 text-[15px]"><span className="font-semibold">Needs:</span> {s.needs}</p>
            <p className="mt-1 text-[15px] text-[color:var(--ink-2)]"><span className="font-semibold text-[color:var(--ink)]">Expect:</span> {s.expect}</p>
          </li>
        ))}
      </ol>
      <section className="plate mt-8 p-6">
        <p className="eyebrow">Cost per rebuild</p>
        <table className="table-k mt-3">
          <tbody>
            <tr><td>BigQuery census (sql/04 and sql/05, both windows)</td><td className="mono">{f.cost.rebuild_gb} GB scanned, about ${f.cost.rebuild_usd_at_on_demand_price} at the on-demand price; inside the free monthly terabyte</td></tr>
            <tr><td>Key sample</td><td className="mono">{f.data.blocks_sampled} blocks and {f.data.transactions_classified} classified transactions over {f.data.weeks_sampled} weeks; free public endpoints; no key</td></tr>
            <tr><td>One forward observation on chain</td><td className="mono">{f.crank?.posted?.[0]?.gas_burnt ? `${f.crank.posted[0].gas_burnt} gas` : "measured at the first post"}</td></tr>
          </tbody>
        </table>
        <p className="mt-3 text-[13px] text-[color:var(--ink-2)]">{f.cost.free_tier_note} Source: data/out/bq_runs.jsonl.</p>
      </section>
    </div>
  );
}
