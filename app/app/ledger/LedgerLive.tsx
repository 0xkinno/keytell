"use client";
import { useEffect, useState } from "react";
import { Check, X, RefreshCw } from "lucide-react";
import { view, accessKeys, accountInfo } from "@/lib/near";
import { EXPLORER } from "@/lib/config";
import { useSecondsUntil } from "@/components/Clock";
import { connect, resolveClaim } from "@/lib/wallet";
import { nsToIso } from "@/lib/format";
import chain from "@/lib/generated/chain.json";
import facts from "@/lib/generated/facts.json";

function dhms(s: number | null) {
  if (s === null) return "--";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m ${s % 60}s`;
}

export function LedgerLive() {
  const f = facts as any;
  const ch = chain as any;
  const [claim, setClaim] = useState<any>(null);
  const [obs, setObs] = useState<any[] | null>(null);
  const [ledgerKeys, setLedgerKeys] = useState<number | null>(null);
  const [crankKeys, setCrankKeys] = useState<any[] | null>(null);
  const [codeHash, setCodeHash] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const left = useSecondsUntil(f.claim?.window_end_ns ?? null);
  const startsIn = useSecondsUntil(f.claim?.window_start_ns ?? null);

  useEffect(() => {
    if (!f.claim) return;
    const L = f.claim.ledger, C = f.deployment.crank;
    view("testnet", L, "get_claim", { claim_id: f.claim.id }).then(setClaim).catch((e) => setErr(String(e.message ?? e)));
    view<any[]>("testnet", L, "observations", { claim_id: f.claim.id }).then(setObs).catch(() => setObs([]));
    accessKeys("testnet", L).then((k) => setLedgerKeys(k.length)).catch(() => setLedgerKeys(null));
    accessKeys("testnet", C).then(setCrankKeys).catch(() => setCrankKeys([]));
    accountInfo("testnet", L).then((a) => setCodeHash(a?.code_hash ?? null)).catch(() => null);
  }, [f.claim, f.deployment]);

  const postTx: Record<number, string> = Object.fromEntries((ch.crank?.posted ?? []).map((p: any) => [p.period, p.hash]));
  const fcKey = crankKeys?.find((k) => k.public_key === f.deployment?.crank_post_key);
  const canResolve = left === 0 && claim?.status === "Open";

  return (
    <div className="space-y-8">
      <section className="plate p-6 sm:p-8">
        <p className="eyebrow">The claim, as stored on chain</p>
        {err && <p className="mt-3 text-[color:var(--oxide-ink)]">Could not read the ledger right now ({err}). The committed record below is from data/registration.json.</p>}
        <p className="serif mt-3 text-[24px] leading-snug">&ldquo;{(claim ?? ch.registration?.claim)?.statement}&rdquo;</p>
        <dl className="mt-6 grid gap-x-8 gap-y-3 text-[14px] sm:grid-cols-2">
          {[
            ["Claim id", f.claim?.id],
            ["Status", claim ? claim.status : "reading"],
            ["Registered", claim ? nsToIso(claim.registered_at_ns) : f.claim?.registered_at],
            ["Window", f.claim ? `${nsToIso(f.claim.window_start_ns).slice(0, 10)} to ${nsToIso(f.claim.window_end_ns).slice(0, 10)}, ${f.claim.forward_weeks} weekly periods` : ""],
            ["Comparator", claim?.comparator ?? f.claim?.comparator],
            ["Threshold", `${(Number(claim?.threshold_e6 ?? f.claim?.threshold_e6) / 1e4).toFixed(0)} percent of posted weeks; at least ${f.claim?.min_periods} weeks posted`],
            ["method_sha256", claim?.method_sha256 ?? f.claim?.method_sha256],
            ["sql_sha256", claim?.sql_sha256 ?? f.claim?.sql_sha256],
            ["data_commit", claim?.data_commit ?? f.claim?.data_commit],
            ["Posted / wins", claim ? `${claim.posted} / ${claim.wins}` : "reading"],
          ].map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="mono text-[11.5px] uppercase tracking-[0.12em] text-[color:var(--ink-2)]">{k}</dt><dd className="mono mt-0.5 break-all">{v}</dd></div>
          ))}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          {f.claim && <a className="btn btn-ink" href={EXPLORER.testnet(f.claim.registration_tx)} target="_blank" rel="noreferrer">Registration transaction</a>}
          <a className="btn btn-line" href={EXPLORER.accountTestnet(f.claim?.ledger ?? "")} target="_blank" rel="noreferrer">Ledger account</a>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="plate p-6">
          <p className="eyebrow">Nobody can edit it</p>
          <ul className="mt-4 space-y-3 text-[15px]">
            <Row ok={ledgerKeys === null ? null : ledgerKeys === 0} text={`Access keys on ${f.claim?.ledger}: ${ledgerKeys ?? "reading"}`} />
            <Row ok={codeHash === null ? null : codeHash === f.deployment?.code_hash_b58} text={`Code hash on chain ${codeHash ?? "reading"}; reproducible build ${f.deployment?.code_hash_b58}`} />
            <Row ok={true} text="No edit, upgrade or withdraw method exists in the contract (an edit_threshold call fails with MethodNotFound; see the break campaign)." />
          </ul>
        </div>
        <div className="plate p-6">
          <p className="eyebrow">The crank signs like an app</p>
          <p className="mt-3 text-[15px] text-[color:var(--ink-2)]">Observations are posted by <span className="mono">{f.deployment?.crank}</span> with a function-call key: the same kind of scoped key whose signatures the thesis counts. Read live with view_access_key_list:</p>
          {fcKey ? (
            <pre tabIndex={0} className="sql mt-3 text-[12px]">{JSON.stringify({ public_key: fcKey.public_key, permission: fcKey.access_key.permission }, null, 2)}</pre>
          ) : <p className="mono mt-3 text-[13px]">{crankKeys ? "post key not found" : "reading"}</p>}
        </div>
      </section>

      <section className="plate p-6 sm:p-8">
        <p className="eyebrow">Observations</p>
        <h2 className="display mt-2 text-[30px]">Every posted week</h2>
        {startsIn !== null && startsIn > 0 && <p className="mt-3 text-[15px] text-[color:var(--ink-2)]">The forward window opens in <span className="mono">{dhms(startsIn)}</span>. The first week can be posted once it has ended.</p>}
        <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
          <table className="table-k">
            <thead><tr><th>Week</th><th>Period</th><th>FC error</th><th>DAA error</th><th>Price error</th><th>Win</th><th>Output sha256</th><th>Transaction</th></tr></thead>
            <tbody>
              {obs === null ? <tr><td colSpan={8}>Reading the ledger.</td></tr> : obs.length === 0 ? <tr><td colSpan={8}>No week posted yet.</td></tr> : obs.map((o) => (
                <tr key={o.period}>
                  <td className="mono">{nsToIso(o.period_start_ns).slice(0, 10)}</td><td className="mono">{o.period}</td>
                  <td className="mono">{o.value_e6}</td><td className="mono">{o.baseline_daa_e6}</td><td className="mono">{o.baseline_price_e6}</td>
                  <td>{o.win ? <span className="tag tag-for">win</span> : <span className="tag tag-against">loss</span>}</td>
                  <td className="mono break-all text-[12px]">{o.rows_sha256.slice(0, 16)}...</td>
                  <td className="mono text-[12px]">{postTx[o.period] ? <a className="ulink" href={EXPLORER.testnet(postTx[o.period])} target="_blank" rel="noreferrer">{postTx[o.period].slice(0, 10)}...</a> : "see events"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="plate p-6 sm:p-8">
        <p className="eyebrow">Resolve</p>
        <h2 className="display mt-2 text-[30px]">Anyone may resolve after the window ends</h2>
        <p className="mt-3 text-[15px] text-[color:var(--ink-2)]">Time left: <span className="mono">{dhms(left)}</span>. Until then the contract refuses with E_WINDOW_OPEN.</p>
        <button type="button" className="btn btn-ink mt-4" disabled={!canResolve} onClick={async () => {
          try { await connect("testnet"); const r = await resolveClaim(f.claim.ledger, f.claim.id); setMsg(`Sent: ${r?.transaction?.hash ?? "check your wallet"}`); } catch (e) { setMsg(String((e as Error).message ?? e)); }
        }}>
          {canResolve ? "Resolve the claim" : `Resolve opens in ${dhms(left)}`}
        </button>
        {msg && <p className="mono mt-3 text-[13px]" aria-live="polite">{msg}</p>}
      </section>
    </div>
  );
}

function Row({ ok, text }: { ok: boolean | null; text: string }) {
  return (
    <li className="flex gap-3">
      <span role="img" aria-label={ok === null ? "checking" : ok ? "pass" : "fail"} className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${ok === null ? "bg-[color:var(--ink-2)]/40" : ok ? "bg-[color:var(--verdigris-ink)]" : "bg-[color:var(--oxide)]"}`}>
        {ok === null ? <RefreshCw size={12} className="animate-spin motion-reduce:animate-none" /> : ok ? <Check size={14} /> : <X size={14} />}
      </span>
      <span className="min-w-0 break-words">{text}</span>
    </li>
  );
}
