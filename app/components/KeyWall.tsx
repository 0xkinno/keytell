"use client";
import { useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";
import weeklyData from "@/lib/generated/weekly.json";
import { pct, num } from "@/lib/format";

type W = (typeof weeklyData)[number] & { window: string };
const weekly = weeklyData as W[];

// Fixed colour scale: FC share 0 -> dark bronze, 0.2 -> copper, 0.4 and above -> pale copper.
const fill = scaleLinear<string>().domain([0, 0.2, 0.4]).range(["#3a2a1c", "#d27a2c", "#f6c58c"]).clamp(true);
const CW = 26, CH = 40;

function Key({ w, x, y, delay, onEnter, onLeave }: { w: W | null; x: number; y: number; delay: number; onEnter: () => void; onLeave: () => void }) {
  const has = w && w.fc_share !== null;
  const future = w?.window === "forward";
  const oos = w?.window === "out_of_sample";
  const c = has ? fill(w!.fc_share!) : "transparent";
  return (
    <g transform={`translate(${x},${y})`} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <circle cx={CW / 2} cy={2.5} r={1.6} fill="#a98b54" opacity={0.7} />
      <g className="key-peg swing" style={{ animationDelay: `${delay}ms` }}>
        <line x1={CW / 2} y1={2.5} x2={CW / 2} y2={6} stroke="#a98b54" strokeWidth={0.8} opacity={0.6} />
        <circle cx={CW / 2} cy={12} r={6.3} fill={c} stroke={future ? "#a7b0b5" : oos ? "#e8c07a" : has ? "none" : "#55606a"} strokeWidth={future || !has ? 1 : oos ? 1.4 : 0} strokeDasharray={future || !has ? "2 2" : undefined} />
        <circle cx={CW / 2} cy={12} r={2.1} fill="#0b1013" />
        {w?.episode && <path d={`M${CW / 2 + 3.6} ${8.6} L${CW / 2 + 7.2} ${12} L${CW / 2 + 3.6} ${15.4} Z`} fill="#0b1013" />}
        <rect x={CW / 2 - 1.4} y={18} width={2.8} height={17} rx={1} fill={has ? c : "none"} stroke={has ? "none" : future ? "#a7b0b5" : "#55606a"} strokeWidth={0.8} strokeDasharray={has ? undefined : "2 2"} />
        {has && <path d={`M${CW / 2 + 1.4} 28h3.2v2.4h-3.2zM${CW / 2 + 1.4} 32.4h4.6v2.6h-4.6z`} fill={c} />}
      </g>
    </g>
  );
}

function Wall({ cols, rows, className, label }: { cols: number; rows: number; className: string; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const cells = useMemo(() => {
    const out: { w: W | null; col: number; row: number }[] = [];
    for (let i = 0; i < cols * rows; i++) {
      const w = weekly[i] ?? null;
      out.push({ w, col: Math.floor(i / rows), row: i % rows });
    }
    return out;
  }, [cols, rows]);
  const width = cols * CW, height = rows * CH;
  const h = hover !== null ? cells[hover] : null;
  return (
    <div className={`relative ${className}`}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto w-full" role="img" aria-label={label}>
        {cells.map((c, i) => (
          <Key key={i} w={c.w} x={c.col * CW} y={c.row * CH} delay={c.col * 45 + c.row * 6} onEnter={() => setHover(i)} onLeave={() => setHover(null)} />
        ))}
      </svg>
      {h?.w && (
        <div
          className="pointer-events-none absolute z-10 w-[230px] rounded-lg border border-white/15 bg-[#151c20] p-3 text-[12px] text-[#eef0f1] shadow-xl"
          style={{ left: `min(calc(${((h.col + 0.5) / cols) * 100}% + 8px), calc(100% - 238px))`, top: `${((h.row + 1) / rows) * 100}%` }}
          aria-hidden
        >
          <p className="mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--brass)]">{h.w.week} · {h.w.window.replace(/_/g, " ")}</p>
          <p className="mono mt-1.5">FC share {pct(h.w.fc_share)}{h.w.fc_share_lo !== null ? ` (${pct(h.w.fc_share_lo)} to ${pct(h.w.fc_share_hi)})` : ""}</p>
          <p className="mono">DAA {num(h.w.daa)}</p>
          {h.w.episode && <p className="mono text-[#f0a48f]">flagged episode week</p>}
          <p className="mt-1.5 text-[11px] text-[color:var(--fog)]">{h.w.fc_share !== null ? `Sample of ${h.w.txs_classified} transactions, classified at signing time` : h.w.window === "forward" ? "Forward week: not measured yet" : "Not sampled"}</p>
        </div>
      )}
    </div>
  );
}

export function KeyWall() {
  const sampled = weekly.filter((w) => w.fc_share !== null);
  const caption = `The Key Wall: one key per week from ${weekly[0]?.week ?? "n/a"}, filled by the share of sampled mainnet transactions signed by a function-call key (darker is lower). Notched bows mark flagged episode weeks; outlined bows are out-of-sample weeks; dashed keys are weeks not measured yet.`;
  return (
    <figure className="w-full">
      <Wall cols={20} rows={14} className="hidden md:block" label={caption} />
      <Wall cols={7} rows={40} className="md:hidden" label={caption} />
      <figcaption className="mt-3 text-[12px] leading-relaxed text-[color:var(--fog)]">
        <span className="mr-3 inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#3a2a1c" }} /> 0%</span>
        <span className="mr-3 inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#d27a2c" }} /> 20%</span>
        <span className="mr-3 inline-flex items-center gap-1.5"><span aria-hidden className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: "#f6c58c" }} /> 40%+ of transactions signed by a function-call key</span>
        <span className="block mt-1">{caption}</span>
      </figcaption>
      <table className="sr-only">
        <caption>Weekly share of transactions signed by function-call keys</caption>
        <thead><tr><th>Week</th><th>FC share</th><th>95% interval</th><th>DAA</th><th>Window</th></tr></thead>
        <tbody>
          {sampled.map((w) => (
            <tr key={w.week}><td>{w.week}</td><td>{pct(w.fc_share)}</td><td>{pct(w.fc_share_lo)} to {pct(w.fc_share_hi)}</td><td>{num(w.daa)}</td><td>{w.window}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
