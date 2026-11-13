import chain from "@/lib/generated/chain.json";
import { EXPLORER } from "@/lib/config";

/** The break campaign: each refusal of the ledger as a real failed testnet transaction. */
export function BreakList() {
  const brk = (chain as any).break;
  return (
    <section className="plate p-6 sm:p-8">
      <p className="eyebrow">Break campaign</p>
      <h2 className="display mt-2 text-[30px]">Every way to cheat, refused on testnet</h2>
      <p className="mt-3 max-w-3xl text-[15px] text-[color:var(--ink-2)]">Each row is a real transaction sent to a twin ledger on testnet (same code hash) that tried something the contract must refuse, with the refusal code decoded from the failure. Script: scripts/break.ts; record: data/break.json.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="table-k">
          <thead><tr><th>Attempt</th><th>Expected</th><th>Got</th><th>Transaction</th></tr></thead>
          <tbody>
            {!brk ? <tr><td colSpan={4}>The break campaign has not been recorded yet.</td></tr> : brk.results.map((r: any) => (
              <tr key={r.name}>
                <td>{r.name}</td><td className="mono">{r.expected}</td>
                <td><span className={`tag ${r.ok_as_designed ? "tag-for" : "tag-against"}`}>{r.got ?? "none"}</span></td>
                <td className="mono text-[12px]">{r.hash ? <a className="ulink" href={EXPLORER.testnet(r.hash)} target="_blank" rel="noreferrer">{r.hash.slice(0, 12)}...</a> : "rejected before broadcast"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
