import Link from "next/link";
import { Mark } from "./Logo";
import { UtcClock } from "./Clock";
import { REPO } from "@/lib/config";
import facts from "@/lib/generated/facts.json";

export function Footer() {
  const f = facts as any;
  return (
    <footer className="vault no-print mt-28 rounded-t-[28px]">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 pb-10 pt-16 sm:px-10 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-3"><Mark size={30} title="" /><span className="display text-[26px]">Keytell</span></div>
          <p className="mt-4 max-w-md text-[15px] text-[color:var(--fog)]">A pre-registered, re-runnable test of one claim about NEAR: that scoped app keys, not account counts or price, show real usage first. Built at NEAR HACKATHON, November 2026.</p>
          <p className="mt-3 max-w-md text-[13px] text-[color:var(--fog)]">Nothing here is investment advice. Tolu Adeyemi is a fictional analyst. Price data: Coin Metrics Community Data. Chain data: BigQuery public dataset {f.data?.bigquery_dataset} and the FastNEAR block archive.</p>
        </div>
        <nav aria-label="Research">
          <p className="eyebrow">Research</p>
          <ul className="mt-3 space-y-1 text-[15px]">
            {[["/evidence", "The evidence for"], ["/against", "The evidence against"], ["/ledger", "The on-chain claim"], ["/memo", "The analyst memo"]].map(([h, l]) => (
              <li key={h}><Link className="course-link inline-flex min-h-11 items-center" href={h}>{l}</Link></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Check it">
          <p className="eyebrow">Check it</p>
          <ul className="mt-3 space-y-1 text-[15px]">
            <li><Link className="course-link inline-flex min-h-11 items-center" href="/keys">Classify any account</Link></li>
            <li><Link className="course-link inline-flex min-h-11 items-center" href="/rerun">Rerun every number</Link></li>
            <li><Link className="course-link inline-flex min-h-11 items-center" href="/proof">Proof from chain</Link></li>
            <li><a className="course-link inline-flex min-h-11 items-center" href={REPO}>Source code (MIT)</a></li>
            <li><Link className="course-link inline-flex min-h-11 items-center" href="/api/status">Service status</Link></li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-5 sm:px-10">
        <span className="strip">Ledger · {f.claim?.ledger} · testnet</span>
        <UtcClock className="strip" />
      </div>
    </footer>
  );
}
