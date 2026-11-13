"use client";
import { useMemo, useState } from "react";
import { scaleLinear, scaleLog, scaleUtc } from "d3-scale";
import { line } from "d3-shape";
import { extent } from "d3-array";

export interface Series { key: string; label: string; color: string; dash?: string; values: (number | null)[]; width?: number }
export interface Rule { date: string; label: string }
export interface Band { from: string; to: string; label: string }

const W = 760, PAD = { l: 52, r: 128, t: 18, b: 34 };

export type Fmt = "compact" | "pct" | "fixed0" | "fixed2" | "fixed3";
const FMT: Record<Fmt, (v: number) => string> = {
  compact: (v) => Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v),
  pct: (v) => `${(v * 100).toFixed(v < 0.1 && v > -0.1 ? 1 : 0)}%`,
  fixed0: (v) => v.toFixed(0),
  fixed2: (v) => v.toFixed(2),
  fixed3: (v) => v.toFixed(3),
};

export function LineChart({ dates, series, height = 300, logY = false, yFormat: yf = "fixed2", rules = [], bands = [], title, valueFormat: vf }: {
  dates: string[]; series: Series[]; height?: number; logY?: boolean; yFormat?: Fmt; rules?: Rule[]; bands?: Band[]; title: string; valueFormat?: Fmt;
}) {
  const yFormat = FMT[yf];
  const valueFormat = vf ? FMT[vf] : undefined;
  const [hi, setHi] = useState<number | null>(null);
  const xs = useMemo(() => dates.map((d) => new Date(`${d}T00:00:00Z`)), [dates]);
  const all = series.flatMap((s) => s.values.filter((v): v is number => v !== null && Number.isFinite(v) && (!logY || v > 0)));
  const [lo, hiV] = (extent(all) as [number, number]) ?? [0, 1];
  const x = scaleUtc().domain([xs[0], xs[xs.length - 1]]).range([PAD.l, W - PAD.r]);
  const y = (logY ? scaleLog().domain([Math.max(lo * 0.9, 1e-9), hiV * 1.1]) : scaleLinear().domain([Math.min(0, lo), hiV * 1.08])).range([height - PAD.b, PAD.t]).nice();
  const [d0, d1] = (y as any).domain() as [number, number];
  const yTicks: number[] = logY
    ? (() => {
        const out: number[] = [];
        for (let e = Math.floor(Math.log10(d0)); e <= Math.ceil(Math.log10(d1)); e++) for (const m of [1, 3]) { const v = m * 10 ** e; if (v >= d0 && v <= d1) out.push(v); }
        return out.length > 7 ? out.filter((v) => Math.log10(v) % 1 === 0) : out;
      })()
    : (y as any).ticks(5);
  const spanDays = (xs[xs.length - 1].getTime() - xs[0].getTime()) / 86_400_000;
  const xTicks = x.ticks(6);
  const xLabel = (t: Date) => (spanDays > 400 ? t.toISOString().slice(0, 7) : t.toISOString().slice(0, 10));
  const path = (vals: (number | null)[]) =>
    line<number | null>().defined((v) => v !== null && Number.isFinite(v) && (!logY || (v as number) > 0)).x((_, i) => x(xs[i])).y((v) => y(v as number))(vals) ?? "";
  // Direct labels at each series' last value, nudged apart.
  const labels = series.map((s) => {
    let i = s.values.length - 1;
    while (i >= 0 && (s.values[i] === null || !Number.isFinite(s.values[i] as number))) i--;
    return { s, yPos: i >= 0 ? y(s.values[i] as number) : PAD.t };
  }).sort((a, b) => a.yPos - b.yPos);
  for (let k = 1; k < labels.length; k++) if (labels[k].yPos - labels[k - 1].yPos < 15) labels[k].yPos = labels[k - 1].yPos + 15;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={title}
        onMouseLeave={() => setHi(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const px = ((e.clientX - r.left) / r.width) * W;
          const t = x.invert(px).getTime();
          let best = 0;
          xs.forEach((d, i) => { if (Math.abs(d.getTime() - t) < Math.abs(xs[best].getTime() - t)) best = i; });
          setHi(best);
        }}>
        {bands.map((b) => (
          <g key={b.label}>
            <rect x={x(new Date(`${b.from}T00:00:00Z`))} y={PAD.t} width={Math.max(0, x(new Date(`${b.to}T00:00:00Z`)) - x(new Date(`${b.from}T00:00:00Z`)))} height={height - PAD.t - PAD.b} fill="rgba(20,24,27,0.045)" />
            <text x={x(new Date(`${b.from}T00:00:00Z`)) + 4} y={PAD.t + 11} fontSize="10.5" fill="#4a5156" fontFamily="var(--font-plex)">{b.label}</text>
          </g>
        ))}
        {yTicks.map((t: number) => (
          <g key={t}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(20,24,27,0.09)" />
            <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4a5156" fontFamily="var(--font-plex)">{yFormat(t)}</text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t.toISOString()} x={x(t)} y={height - 12} textAnchor="middle" fontSize="11" fill="#4a5156" fontFamily="var(--font-plex)">{xLabel(t)}</text>
        ))}
        {rules.map((r) => {
          const xr = x(new Date(`${r.date}T00:00:00Z`));
          if (xr < PAD.l || xr > W - PAD.r) return null;
          return (
            <g key={r.label}>
              <line x1={xr} x2={xr} y1={PAD.t} y2={height - PAD.b} stroke="#14181b" strokeDasharray="3 3" strokeWidth={1} />
              <text x={xr + 4} y={height - PAD.b - 6} fontSize="10.5" fill="#14181b" fontFamily="var(--font-plex)">{r.label}</text>
            </g>
          );
        })}
        {series.map((s) => (
          <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} strokeLinejoin="round" />
        ))}
        {labels.map(({ s, yPos }) => (
          <text key={s.key} x={W - PAD.r + 8} y={yPos + 4} fontSize="12" fill={s.color === "#a7b0b5" ? "#4a5156" : s.color} fontWeight={600} fontFamily="var(--font-instrument)">{s.label}</text>
        ))}
        {hi !== null && <line x1={x(xs[hi])} x2={x(xs[hi])} y1={PAD.t} y2={height - PAD.b} stroke="rgba(20,24,27,0.35)" />}
      </svg>
      {hi !== null && (
        <div className="pointer-events-none absolute right-2 top-2 rounded-md border border-[color:var(--hair)] bg-[color:var(--ledger-hi)] px-3 py-2 text-[12px] shadow" aria-hidden>
          <p className="mono font-semibold">{dates[hi]}</p>
          {series.map((s) => (
            <p key={s.key} className="mono" style={{ color: s.color === "#a7b0b5" ? "#4a5156" : s.color }}>{s.label}: {s.values[hi] === null ? "gap" : (valueFormat ?? yFormat)(s.values[hi] as number)}</p>
          ))}
        </div>
      )}
    </div>
  );
}
