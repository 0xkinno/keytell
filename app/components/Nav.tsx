"use client";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { Mark, Wordmark } from "./Logo";

const LINKS = [
  { href: "/evidence", label: "Evidence" },
  { href: "/against", label: "Against" },
  { href: "/ledger", label: "Ledger" },
  { href: "/keys", label: "Keys" },
  { href: "/memo", label: "Memo" },
  { href: "/rerun", label: "Rerun" },
  { href: "/proof", label: "Proof" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="no-print relative z-50 px-4 pt-4 sm:px-6">
      <nav aria-label="Main" className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-xl pr-2" aria-label="Keytell home">
          <Mark size={30} title="" />
          <Wordmark />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="course-link inline-flex min-h-11 items-center px-3 text-[16px] text-[color:var(--ink)]">{l.label}</Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-3">
          <span className="mono hidden items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-[color:var(--ink-2)] md:inline-flex">
            <span className="dot" aria-hidden /> Near mainnet data
          </span>
          <Link href="/keys" className="btn btn-ink hidden !min-h-12 sm:inline-flex">
            Classify an account <ArrowUpRight size={16} aria-hidden />
          </Link>
          <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-full lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          </button>
        </div>
      </nav>
      {open && (
        <div className="vault mx-auto mt-2 max-w-[1400px] rounded-3xl p-3 lg:hidden">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-2xl px-4 text-[16px] hover:bg-white/5">{l.label}</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
