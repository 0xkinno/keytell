"use client";
import Link from "next/link";
import facts from "@/lib/generated/facts.json";
import { EXPLORER } from "@/lib/config";
import { useClaim } from "./ClaimStatus";
import { useSecondsUntil } from "./Clock";

function dhms(s: number | null) {
  if (s === null) return "--";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return `${d}d ${h}h ${m}m ${s % 60}s`;
}

/** Three stacked sticky plates: register, observe, resolve. */
export function MethodSteps() {
  const f = facts as any;
  const c = useClaim();
  const left = useSecondsUntil(f.claim?.window_end_ns ?? null);
  const steps = [
    {
      n: "1", t: "Register", body: <>The claim, its metric and outcome, the comparator, a 50 percent threshold and the SHA-256 of the method and of every SQL and analysis file were written to <span className="mono">{f.claim?.ledger}</span> at <span className="mono">{f.claim?.registered_at}</span>, before any out-of-sample query ran. The ledger holds {f.deployment?.ledger_access_keys} access keys: nobody can edit it.</>,
      link: f.claim ? { href: EXPLORER.testnet(f.claim.registration_tx), label: "Registration transaction" } : null,
    },
    {
      n: "2", t: "Observe", body: <>Each forward week a crank posts the three forecast errors with the hash of the file they came from. It signs with a function-call key limited to <span className="mono">post</span>, the kind of signature the thesis counts. {c?.source === "chain" ? `${c.posted} of ${f.claim?.forward_weeks} weeks posted so far.` : ""}</>,
      link: { href: "/ledger", label: "See the crank's key and every post" },
    },
    {
      n: "3", t: "Resolve", body: <>After {f.claim ? new Date(Number(BigInt(f.claim.window_end_ns) / 1_000_000n)).toISOString().slice(0, 10) : "the window"} anyone may call <span className="mono">resolve</span>. The contract counts winning weeks against the registered threshold and freezes the result. Time left: <span className="mono">{dhms(left)}</span>.</>,
      link: { href: "/proof", label: "Check it from the chain" },
    },
  ];
  return (
    <div className="mt-10 space-y-6">
      {steps.map((s, i) => (
        <div key={s.n} className="plate sticky p-6 sm:p-8" style={{ top: `${80 + i * 22}px` }}>
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <p className="display text-[64px] leading-none text-[color:var(--copper-ink)]">{s.n}</p>
            <div>
              <h3 className="display text-[30px]">{s.t}</h3>
              <p className="mt-2 max-w-3xl text-[16px] leading-relaxed text-[color:var(--ink-2)]">{s.body}</p>
              {s.link && (s.link.href.startsWith("http") ? <a className="ulink mt-3 inline-flex min-h-11 items-center font-semibold" href={s.link.href} target="_blank" rel="noreferrer">{s.link.label}</a> : <Link className="ulink mt-3 inline-flex min-h-11 items-center font-semibold" href={s.link.href}>{s.link.label}</Link>)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
