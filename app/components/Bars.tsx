"use client";
import { scaleLinear } from "d3-scale";
import { bin, max } from "d3-array";

/** Horizontal bars around zero, labelled directly. */
export function Bars({ rows, title, format = (v: number) => `${(v * 100).toFixed(1)}%` }: { rows: { label: string; value: number | null; color: string; note?: string }[]; title: string; format?: (v: number) => string }) {
  const W = 760, rowH = 46, PAD = { l: 210, r: 90, t: 8, b: 26 };
  const vals = rows.map((r) => r.value ?? 0);
  const lo = Math.min(0, ...vals), hi = Math.max(0, ...vals);
  const span = hi - lo || 1;
  const x = scaleLinear().domain([lo - span * 0.05, hi + span * 0.05]).range([PAD.l, W - PAD.r]);
  const H = PAD.t + rows.length * rowH + PAD.b;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
      <line x1={x(0)} x2={x(0)} y1={PAD.t} y2={H - PAD.b} stroke="#14181b" />
      <text x={x(0)} y={H - 8} textAnchor="middle" fontSize="11" fill="#4a5156" fontFamily="var(--font-plex)">0 = no better than AR(2)</text>
      {rows.map((r, i) => {
        const y = PAD.t + i * rowH + 8;
        const v = r.value ?? 0;
        return (
          <g key={r.label}>
            <text x={PAD.l - 10} y={y + 17} textAnchor="end" fontSize="13.5" fill="#14181b" fontFamily="var(--font-instrument)" fontWeight={600}>{r.label}</text>
            {r.note && <text x={PAD.l - 10} y={y + 31} textAnchor="end" fontSize="11" fill="#4a5156" fontFamily="var(--font-plex)">{r.note}</text>}
            <rect x={Math.min(x(0), x(v))} y={y + 4} width={Math.abs(x(v) - x(0))} height={22} fill={r.color} rx={3} />
            <text x={v >= 0 ? x(v) + 6 : x(v) - 6} y={y + 20} textAnchor={v >= 0 ? "start" : "end"} fontSize="12.5" fill="#14181b" fontFamily="var(--font-plex)">{r.value === null ? "n/a" : format(v)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Histogram of placebo gains with the real value marked. */
export function Histogram({ values, real, p95, title }: { values: number[]; real: number | null; p95: number | null; title: string }) {
  const W = 760, H = 260, PAD = { l: 44, r: 20, t: 14, b: 34 };
  if (!values.length) return <p className="text-[15px] text-[color:var(--ink-2)]">The placebo run has not been computed yet.</p>;
  const lo = Math.min(...values, real ?? 0), hi = Math.max(...values, real ?? 0);
  const x = scaleLinear().domain([lo - (hi - lo) * 0.05, hi + (hi - lo) * 0.05]).range([PAD.l, W - PAD.r]);
  const bins = bin().domain(x.domain() as [number, number]).thresholds(36)(values);
  const y = scaleLinear().domain([0, max(bins, (b) => b.length) ?? 1]).range([H - PAD.b, PAD.t]);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={title}>
      {bins.map((b, i) => <rect key={i} x={x(b.x0!) + 0.5} width={Math.max(0, x(b.x1!) - x(b.x0!) - 1)} y={y(b.length)} height={H - PAD.b - y(b.length)} fill="#a7b0b5" />)}
      {x.ticks(6).map((t) => <text key={t} x={x(t)} y={H - 12} textAnchor="middle" fontSize="11" fill="#4a5156" fontFamily="var(--font-plex)">{(t * 100).toFixed(0)}%</text>)}
      {p95 !== null && <g><line x1={x(p95)} x2={x(p95)} y1={PAD.t} y2={H - PAD.b} stroke="#14181b" strokeDasharray="3 3" /><text x={x(p95) + 4} y={PAD.t + 10} fontSize="11" fill="#14181b" fontFamily="var(--font-plex)">95th percentile of placebos</text></g>}
      {real !== null && <g><line x1={x(real)} x2={x(real)} y1={PAD.t} y2={H - PAD.b} stroke="#d27a2c" strokeWidth={3} /><text x={x(real) + 5} y={PAD.t + 26} fontSize="12" fontWeight={700} fill="#9a5212" fontFamily="var(--font-instrument)">real gain</text></g>}
    </svg>
  );
}
