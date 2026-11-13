"use client";
import { useCallback, useEffect, useState } from "react";
import { Check, X, RefreshCw } from "lucide-react";
import { runChecks, type Check as C } from "@/lib/proof";

export function ProofRunner() {
  const [r, setR] = useState<{ checks: C[]; at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const go = useCallback(async () => {
    setBusy(true);
    const at = new Date().toISOString();
    try { setR(await runChecks(location.origin, (checks) => setR({ checks, at }))); } finally { setBusy(false); }
  }, []);
  useEffect(() => { go(); }, [go]);
  const passed = r?.checks.filter((c) => c.ok).length ?? 0;
  const done = r?.checks.filter((c) => c.ok !== null).length ?? 0;
  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className="btn btn-copper" onClick={go} disabled={busy}><RefreshCw size={16} className={busy ? "animate-spin motion-reduce:animate-none" : ""} aria-hidden /> {busy ? "Reading the chain" : "Recheck from chain"}</button>
        {r && <p className="mono text-[15px]" aria-live="polite">{busy ? `${done} of ${r.checks.length} read` : `${passed} of ${r.checks.length} checks pass · ${r.at}`}</p>}
      </div>
      <ul className="mt-6 space-y-3">
        {r?.checks.map((c) => (
          <li key={c.id} className="plate flex gap-4 p-5">
            <span role="img" aria-label={c.ok === null ? "checking" : c.ok ? "pass" : "fail"} className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white ${c.ok === null ? "bg-[color:var(--ink-2)]/40" : c.ok ? "bg-[color:var(--verdigris-ink)]" : "bg-[color:var(--oxide)]"}`}>{c.ok === null ? <RefreshCw size={13} className="animate-spin motion-reduce:animate-none" /> : c.ok ? <Check size={15} /> : <X size={15} />}</span>
            <div className="min-w-0"><p className="font-semibold">{c.claim}</p><p className="mono mt-1 break-all text-[13px] text-[color:var(--ink-2)]">{c.detail}</p></div>
          </li>
        ))}
      </ul>
    </div>
  );
}
