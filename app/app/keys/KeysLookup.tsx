"use client";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { EXPLORER } from "@/lib/config";

const EXAMPLES = ["aurora", "relay.tg", "social.near", "intents.near"];

const BUCKET: Record<string, { label: string; cls: string; sum?: string }> = {
  FUNCTION_CALL: { sum: "signed by a function-call key", label: "function-call key", cls: "bg-[color:var(--copper)] text-[#1d1206]" },
  FULL_ACCESS: { sum: "signed by a full-access key", label: "full-access key", cls: "bg-[#c9d0d4] text-[#14181b]" },
  IMPLICIT_OR_FULL: { sum: "signed by an implicit account", label: "full-access (implicit account)", cls: "bg-[#c9d0d4] text-[#14181b]" },
  RELAYS_META_TX: { sum: "relayed meta transactions", label: "relays a meta transaction", cls: "bg-[#e7c9a5] text-[#14181b]" },
  UNKNOWN: { sum: "with a key nobody could read", label: "unknown", cls: "bg-[color:var(--oxide)] text-white" },
};

export function KeysLookup() {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  async function go(account: string) {
    if (!account) return;
    setBusy(true);
    setRes(null);
    try {
      const r = await fetch(`/api/lookup?account=${encodeURIComponent(account)}`);
      setRes(await r.json());
      history.replaceState(null, "", `?account=${encodeURIComponent(account)}`);
    } catch (e) {
      setRes({ ok: false, reason: String((e as Error).message) });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const a = new URLSearchParams(location.search).get("account");
    if (a) { setQ(a); go(a); }
  }, []);

  return (
    <div>
      <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(e) => { e.preventDefault(); go(q.trim()); }}>
        <label htmlFor="acct" className="sr-only">NEAR mainnet account</label>
        <input id="acct" value={q} onChange={(e) => setQ(e.target.value)} placeholder="any mainnet account, e.g. aurora" autoComplete="off" spellCheck={false}
          className="mono min-h-14 flex-1 rounded-full border border-[color:var(--hair)] bg-[color:var(--ledger-hi)] px-6 text-[16px]" />
        <button type="submit" className="btn btn-ink !min-h-14" disabled={busy}><Search size={17} aria-hidden /> {busy ? "Reading mainnet" : "Classify"}</button>
      </form>
      <p className="mt-3 text-[14px] text-[color:var(--ink-2)]">Try: {EXAMPLES.map((e, i) => <span key={e}>{i > 0 && ", "}<button type="button" className="ulink mono inline-flex min-h-11 items-center" onClick={() => { setQ(e); go(e); }}>{e}</button></span>)}</p>

      <div aria-live="polite">
        {res && !res.ok && <p className="plate mt-6 p-5 text-[color:var(--oxide-ink)]">{res.reason}</p>}
        {res?.ok && (
          <div className="mt-8 space-y-6">
            <div className="plate p-6">
              <p className="eyebrow">Keys on {res.account} now</p>
              {res.keys_note ? <p className="mt-2 text-[16px]">{res.keys_note}</p> : <p className="display mt-2 text-[30px]">{res.fc_keys} function-call key{res.fc_keys === 1 ? "" : "s"}, {res.full_keys} full-access key{res.full_keys === 1 ? "" : "s"}</p>}
              {res.keys.length > 0 && <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
                <table className="table-k">
                  <thead><tr><th>Public key</th><th>Kind</th><th>Scoped to</th><th>Methods</th><th>Allowance (yocto)</th></tr></thead>
                  <tbody>
                    {res.keys.slice(0, 40).map((k: any) => (
                      <tr key={k.public_key}><td className="mono break-all text-[12px]">{k.public_key}</td><td><span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${k.kind === "FunctionCall" ? BUCKET.FUNCTION_CALL.cls : BUCKET.FULL_ACCESS.cls}`}>{k.kind}</span></td><td className="mono break-all text-[12px]">{k.receiver_id ?? ""}</td><td className="mono text-[12px]">{k.method_names ? (k.method_names.length ? k.method_names.join(", ") : "any method") : ""}</td><td className="mono text-[12px]">{k.allowance ?? (k.kind === "FunctionCall" ? "unlimited" : "")}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>}
              {res.keys.length > 40 && <p className="mt-2 text-[13px] text-[color:var(--ink-2)]">Showing 40 of {res.keys.length} keys.</p>}
            </div>
            <div className="plate p-6">
              <p className="eyebrow">Recent transactions signed by {res.account}</p>
              <p className="mt-2 text-[15px] text-[color:var(--ink-2)]">{Object.entries(res.counts).map(([k, v]) => `${v} ${BUCKET[k]?.sum ?? k}`).join(" · ") || "No signed transactions found in the recent window."}</p>
              <ul className="mt-4 space-y-2">
                {res.recent.map((t: any) => (
                  <li key={t.hash} className="flex flex-wrap items-center gap-3 border-b border-[color:var(--hair)] pb-2 text-[14px]">
                    <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${BUCKET[t.bucket]?.cls}`}>{BUCKET[t.bucket]?.label}</span>
                    <span className="mono text-[12px]">{t.at.slice(0, 16).replace("T", " ")}</span>
                    <span className="mono min-w-0 break-all text-[12px]">to {t.receiver_id} · {t.actions.join(", ")}{t.relayed_for ? ` · for ${t.relayed_for}` : ""}</span>
                    <a className="ulink mono ml-auto inline-flex min-h-11 items-center text-[12px]" href={EXPLORER.mainnet(t.hash)} target="_blank" rel="noreferrer">{t.hash.slice(0, 10)}...</a>
                  </li>
                ))}
              </ul>
              <p className="mono mt-4 text-[12px] text-[color:var(--ink-2)]">Keys: {res.sources.keys}. Transactions: {res.sources.transactions}. Fetched {res.fetched_at}{res.cached ? " (cached under 60 s)" : ""}.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
