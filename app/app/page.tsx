import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Hero } from "@/components/Hero";
import { Reveal } from "@/components/Reveal";
import { KeyMix } from "@/components/KeyMix";
import { MethodSteps } from "@/components/MethodSteps";
import facts from "@/lib/generated/facts.json";
import { pct, compact } from "@/lib/format";

const ISSUES = [
  { href: "/evidence", n: "01", kicker: "The case for", title: "Do small keys move before USDC does?", art: "lead" },
  { href: "/against", n: "02", kicker: "The case against", title: "Is it a few apps, a relayer, or luck?", art: "against" },
  { href: "/ledger", n: "03", kicker: "On chain", title: "The claim, fixed before the data", art: "ledger" },
  { href: "/keys", n: "04", kicker: "Try your own", title: "Read any account's keys", art: "keys" },
  { href: "/memo", n: "05", kicker: "The deliverable", title: "A memo the analyst signs", art: "memo" },
  { href: "/rerun", n: "06", kicker: "For skeptics", title: "Rebuild every number", art: "rerun" },
];

function IssueArt({ kind }: { kind: string }) {
  const c = "#d27a2c";
  return (
    <svg viewBox="0 0 240 120" className="h-auto w-full" aria-hidden>
      <rect width="240" height="120" fill="#0b1013" />
      {kind === "lead" && <><path d="M12 92 C60 88 70 40 110 52 S170 30 228 18" stroke={c} strokeWidth="3" fill="none" /><path d="M12 100 C70 98 90 70 130 76 S190 58 228 44" stroke="#5f7d95" strokeWidth="2" fill="none" strokeDasharray="4 4" /><line x1="150" y1="10" x2="150" y2="110" stroke="#a98b54" strokeDasharray="3 3" /></>}
      {kind === "against" && <>{[18, 42, 66, 90, 114, 138, 162, 186, 210].map((x, i) => <rect key={x} x={x} y={100 - [20, 34, 50, 66, 74, 58, 40, 26, 14][i]} width="16" height={[20, 34, 50, 66, 74, 58, 40, 26, 14][i]} fill="#55606a" />)}<line x1="200" y1="10" x2="200" y2="110" stroke="#b8442f" strokeWidth="3" /></>}
      {kind === "ledger" && <><rect x="70" y="18" width="100" height="84" rx="8" fill="none" stroke="#a98b54" strokeWidth="2" />{[36, 52, 68, 84].map((y) => <line key={y} x1="84" x2="156" y1={y} y2={y} stroke="#a7b0b5" strokeWidth="2" />)}<circle cx="156" cy="92" r="12" fill={c} /></>}
      {kind === "keys" && <>{[40, 100, 160].map((x, i) => <g key={x} transform={`translate(${x},22)`}><circle cx="20" cy="18" r="13" fill={i === 1 ? c : "none"} stroke={c} strokeWidth="3" /><rect x="18" y="31" width="4" height="40" fill={c} /><rect x="22" y="58" width="9" height="4" fill={c} /><rect x="22" y="66" width="12" height="4" fill={c} /></g>)}</>}
      {kind === "memo" && <><rect x="66" y="10" width="108" height="100" rx="4" fill="#fbf9f4" />{[28, 40, 52, 64].map((y) => <line key={y} x1="78" x2="160" y1={y} y2={y} stroke="#c9c2b3" strokeWidth="3" />)}<path d="M82 92c10-12 18 6 28-4s14 2 24-6" stroke={c} strokeWidth="3" fill="none" /></>}
      {kind === "rerun" && <><text x="20" y="44" fill="#a7b0b5" fontFamily="monospace" fontSize="15">$ make verify</text><text x="20" y="70" fill="#4aa391" fontFamily="monospace" fontSize="15">PASS facts</text><text x="20" y="94" fill="#4aa391" fontFamily="monospace" fontSize="15">PASS hashes</text></>}
    </svg>
  );
}

export default function Home() {
  const f = facts as any;
  const b = f.backtest;
  return (
    <>
      <Hero />

      <section id="real" className="scroll-mt-20 px-4 pt-24 sm:px-6">
        <Reveal className="mx-auto max-w-3xl text-center">
          <p className="eyebrow">Monday, 07:40, Lagos</p>
          <h2 className="display mt-4 text-[40px] sm:text-[60px]">&ldquo;Is anyone actually using NEAR, or is it bots and airdrop farmers?&rdquo;</h2>
          <p className="mt-6 text-[18px] leading-relaxed text-[color:var(--ink-2)]">Tolu Adeyemi (fictional), a research analyst at a crypto fund, has twenty minutes before the investment committee. Every dashboard Tolu can open shows daily active accounts and price. Both are cheap to fake: one script makes a thousand accounts, one post moves price. Keytell gives Tolu a claim that was fixed before the data, the evidence for and against it, the SQL behind every chart, and a memo to sign.</p>
        </Reveal>
        <div className="mx-auto mt-14 grid max-w-[1200px] gap-4 md:grid-cols-3">
          <Reveal className="plate p-6">
            <p className="eyebrow">The backtest verdict</p>
            <p className={`display mt-3 text-[30px] ${b?.passed ? "text-[color:var(--verdigris-ink)]" : "text-[color:var(--oxide-ink)]"}`}>{b?.verdict ?? "Not computed yet"}</p>
            <p className="mt-3 text-[15px] text-[color:var(--ink-2)]">{b ? `Out-of-sample gain over ${b.oos_weeks_scored} weeks: function-call keys ${pct(b.oos_gain.fc_signed_tx)}, DAA ${pct(b.oos_gain.daa)}, price ${pct(b.oos_gain.price)}.` : "The out-of-sample run has not finished."}</p>
          </Reveal>
          <Reveal className="plate p-6" delay={0.08}>
            <p className="eyebrow">Signed by a function-call key</p>
            <p className="display mt-3 text-[44px] text-[color:var(--copper-ink)]">{pct(f.latest?.fc_share)}</p>
            <p className="mt-3 text-[15px] text-[color:var(--ink-2)]">{f.latest ? `of sampled mainnet transactions in ${f.latest.week}, interval ${pct(f.latest.fc_share_lo)} to ${pct(f.latest.fc_share_hi)}.` : "No week sampled yet."}</p>
          </Reveal>
          <Reveal className="plate p-6" delay={0.16}>
            <p className="eyebrow">Cost to rebuild the census</p>
            <p className="display mt-3 text-[44px]">{f.cost.rebuild_gb} GB</p>
            <p className="mt-3 text-[15px] text-[color:var(--ink-2)]">scanned on BigQuery, about ${f.cost.rebuild_usd_at_on_demand_price} at the on-demand price (inside the free monthly terabyte). The key sample needs no account at all.</p>
          </Reveal>
        </div>
      </section>

      <section id="who" className="scroll-mt-20 px-4 pt-24 sm:px-6">
        <div className="mx-auto max-w-[1200px]">
          <Reveal>
            <p className="eyebrow">Who signs NEAR transactions</p>
            <h2 className="display mt-3 max-w-3xl text-[36px] sm:text-[48px]">The key mix, week by week, classified at signing time.</h2>
            <p className="mt-4 max-w-3xl text-[17px] leading-relaxed text-[color:var(--ink-2)]">{f.sentences?.latest}</p>
          </Reveal>
          <Reveal className="plate mt-8 p-5 sm:p-8"><KeyMix /></Reveal>
        </div>
      </section>

      <section className="px-4 pt-24 sm:px-6" aria-labelledby="library">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">The briefing library</p>
              <h2 id="library" className="display mt-3 text-[36px] sm:text-[48px]">Six briefs. Every number links to its query.</h2>
            </div>
            <Link href="/evidence" className="btn btn-ink">Start with the evidence <ArrowRight size={16} aria-hidden /></Link>
          </div>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ISSUES.map((i, k) => (
              <li key={i.href}>
                <Reveal delay={k * 0.05}>
                  <Link href={i.href} className="issue block">
                    <IssueArt kind={i.art} />
                    <div className="p-5">
                      <p className="mono text-[12px] tracking-[0.14em] text-[color:var(--copper-ink)]">BRIEF {i.n} · {i.kicker.toUpperCase()}</p>
                      <p className="serif mt-2 text-[24px] leading-tight">{i.title}</p>
                      <p className="mt-4 inline-flex items-center gap-1.5 text-[14px] font-semibold">Read the brief <ArrowUpRight size={15} aria-hidden /></p>
                    </div>
                  </Link>
                </Reveal>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="prereg" className="scroll-mt-20 px-4 pt-24 sm:px-6">
        <div className="mx-auto max-w-[1200px]">
          <p className="eyebrow">Was it pre-registered?</p>
          <h2 className="display mt-3 max-w-3xl text-[36px] sm:text-[48px]">Registered on NEAR, observed by an app key, resolved by anyone.</h2>
          <MethodSteps />
        </div>
      </section>

      <section id="change" className="scroll-mt-20 px-4 pt-24 sm:px-6">
        <div className="mx-auto grid max-w-[1200px] gap-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="eyebrow">What would change our mind</p>
            <h2 className="display mt-3 text-[36px] sm:text-[48px]">The conditions were written down first.</h2>
            <p className="mt-4 text-[17px] text-[color:var(--ink-2)]">Each of these is a control in the registered method. If one breaks the result, the page says so.</p>
          </div>
          <ul className="space-y-3">
            {[
              ["If DAA or price forecasts USDC volume as well", "The pass rule needs function-call activity to beat both, with both bootstrap intervals below zero."],
              ["If the signal is a few apps", "Rerun without the ten most common function-call scopes and without the ten busiest signers."],
              ["If it is relayers, not people", "Rerun with meta transactions counted as function-call, as full access, and left out."],
              ["If it is timing luck", "1,000 shifted placebos; the real gain must beat 95 percent of them."],
              ["If unread keys hide the answer", "Rerun with every unknown key counted each way."],
              ["If the next twelve weeks disagree", "The forward claim on chain resolves without us, from posted weeks."],
            ].map(([h, t]) => (
              <li key={h} className="plate p-5"><p className="font-semibold">{h}</p><p className="mt-1 text-[15px] text-[color:var(--ink-2)]">{t}</p></li>
            ))}
            <li><Link href="/against" className="course-link inline-flex min-h-11 items-center gap-2 font-semibold text-[color:var(--oxide-ink)]">See every control and how it came out <ArrowRight size={16} aria-hidden /></Link></li>
          </ul>
        </div>
      </section>
    </>
  );
}
