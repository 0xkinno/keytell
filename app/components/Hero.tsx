import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { KeyWall } from "./KeyWall";
import { ClaimStatusDot } from "./ClaimStatus";
import { UtcClock } from "./Clock";
import { HeroPatch } from "./Reveal";
import facts from "@/lib/generated/facts.json";

const CHIPS = [
  { href: "#real", label: "Is usage real?" },
  { href: "#who", label: "Who signs?" },
  { href: "#change", label: "What would change our mind?" },
  { href: "#prereg", label: "Was it pre-registered?" },
];

export function Hero() {
  const f = facts as any;
  return (
    <section aria-labelledby="hero-title" className="px-2 sm:px-4">
      <div className="vault relative mx-auto max-w-[1440px] overflow-hidden rounded-[28px] sm:rounded-[36px]">
        <div className="grid gap-10 px-6 pb-8 pt-12 sm:px-12 sm:pt-16 lg:grid-cols-[1.02fr_1fr] lg:gap-6 lg:pb-10 lg:pt-20">
          <HeroPatch>
            <p className="eyebrow flex items-center gap-2.5"><span className="dot" aria-hidden /> Read from NEAR mainnet</p>
            <h1 id="hero-title" className="display mt-6 text-[52px] leading-[0.95] sm:text-[78px] xl:text-[96px]">
              Count the<br />small keys.<br /><span className="text-[color:var(--copper)]">Not the accounts.</span>
            </h1>
            <p className="mt-7 max-w-xl text-[18px] leading-relaxed text-[#d5dadc] sm:text-[20px]">
              On NEAR, every transaction says which kind of key signed it. Apps and agents sign with scoped function-call keys; one-off transfers sign with the master key. Keytell tests, with a claim fixed on chain before the data, whether those small keys show real usage before account counts or price do.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/evidence" className="btn btn-copper">See the evidence <ArrowRight size={17} aria-hidden /></Link>
              <Link href="/keys" className="btn btn-ghost">Classify any account <span className="arrow"><ArrowUpRight size={17} aria-hidden /></span></Link>
            </div>
            <ul className="mt-8 flex flex-wrap gap-2.5" aria-label="Questions this page answers">
              {CHIPS.map((c) => <li key={c.href}><a href={c.href} className="chip">{c.label}</a></li>)}
            </ul>
          </HeroPatch>
          <div className="lg:pl-4"><KeyWall /></div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 px-6 py-4 sm:px-12">
          <span className="strip">BigQuery · crypto_near_mainnet_us · through {f.data?.census_last_day ?? "n/a"}</span>
          <ClaimStatusDot className="strip" />
          <span className="strip flex items-center gap-4"><UtcClock /> <span aria-hidden>Scroll</span></span>
        </div>
      </div>
    </section>
  );
}
