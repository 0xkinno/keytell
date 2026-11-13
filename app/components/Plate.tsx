"use client";
import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import sqlData from "@/lib/generated/sql.json";
import { BQ_CONSOLE, REPO } from "@/lib/config";

type Sql = (typeof sqlData)[number];
const SQL = sqlData as Sql[];

export function SqlBlock({ file, start, end }: { file: string; start?: string; end?: string }) {
  const s = SQL.find((x) => x.file === file);
  const [copied, setCopied] = useState(false);
  if (!s) return null;
  const literal = s.body.replaceAll("@start", `'${start ?? "2024-12-30"}'`).replaceAll("@end", `'${end ?? "2026-11-08"}'`);
  const billed = s.runs.reduce((a: number, r: any) => a + r.bytes_billed, 0);
  return (
    <details className="group mt-4 rounded-lg border border-[color:var(--hair)] bg-[color:var(--ledger)]/60">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-4 py-2 text-[14px] font-semibold">
        <span>Show the SQL <span className="mono font-normal text-[color:var(--ink-2)]">{s.file}</span></span>
        <span className="mono text-[12px] font-normal text-[color:var(--ink-2)]">{s.ran ? `${(billed / 1e9).toFixed(1)} GB scanned` : "not run (see header)"}</span>
      </summary>
      <div className="px-4 pb-4">
        <pre className="sql">{s.header}{"\n\n"}{s.body}</pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn btn-line !min-h-11 !text-[14px]" onClick={async () => { await navigator.clipboard?.writeText(literal); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
            {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />} {copied ? "Copied" : "Copy runnable SQL"}
          </button>
          <a className="btn btn-line !min-h-11 !text-[14px]" href={BQ_CONSOLE(literal)} target="_blank" rel="noreferrer">Open in BigQuery <ExternalLink size={14} aria-hidden /></a>
          <a className="btn btn-line !min-h-11 !text-[14px]" href={`${REPO}/blob/main/${s.file}`} target="_blank" rel="noreferrer">View on GitHub <ExternalLink size={14} aria-hidden /></a>
        </div>
        {s.runs.length > 0 && (
          <ul className="mono mt-3 space-y-1 text-[12px] text-[color:var(--ink-2)]">
            {s.runs.map((r: any) => <li key={r.start}>{r.start} to {r.end}: {(r.bytes_billed / 1e9).toFixed(2)} GB, {r.rows} rows, output sha256 {r.out_sha256.slice(0, 16)}..., ran {r.ran_at}</li>)}
          </ul>
        )}
      </div>
    </details>
  );
}

export function Plate({ id, n, question, sentence, children, source, sql, side, code }: {
  id?: string; n?: string; question: string; sentence?: string | null; children: React.ReactNode; source: string; sql?: { file: string; start?: string; end?: string }[]; side?: "for" | "against"; code?: { label: string; path: string }[];
}) {
  return (
    <section id={id} className="plate scroll-mt-24 p-5 sm:p-8">
      <div className="flex flex-wrap items-center gap-3">
        {n && <span className="mono text-[12px] tracking-[0.14em] text-[color:var(--copper-ink)]">BRIEF {n}</span>}
        {side && <span className={`tag ${side === "for" ? "tag-for" : "tag-against"}`}>{side === "for" ? "Evidence for" : "Evidence against"}</span>}
      </div>
      <h2 className="display mt-3 text-[28px] sm:text-[36px]">{question}</h2>
      {sentence && <p className="mt-3 max-w-3xl text-[17px] leading-relaxed text-[color:var(--ink-2)]">{sentence}</p>}
      <div className="mt-6">{children}</div>
      <p className="mono mt-4 text-[12px] leading-relaxed text-[color:var(--ink-2)]">Source: {source}</p>
      {code?.map((c) => (
        <a key={c.path} className="mono ulink mr-4 inline-flex min-h-11 items-center text-[12px] text-[color:var(--copper-ink)]" href={`${REPO}/blob/main/${c.path}`} target="_blank" rel="noreferrer">{c.label}: {c.path}</a>
      ))}
      {sql?.map((s) => <SqlBlock key={s.file + (s.start ?? "")} {...s} />)}
    </section>
  );
}
