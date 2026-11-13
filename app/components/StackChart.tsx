"use client";
import { scaleLinear, scaleUtc } from "d3-scale";
import { area, stack } from "d3-shape";

export interface Layer { key: string; label: string; color: string; pattern?: boolean }

const W = 760, PAD = { l: 44, r: 150, t: 12, b: 30 };

/** A 100 percent stacked area of the weekly key mix. Missing weeks are left as gaps. */
export function StackChart({ dates, rows, layers, height = 280, title }: { dates: string[]; rows: Record<string, number | null>[]; layers: Layer[]; height?: number; title: string }) {
  const xs = dates.map((d) => new Date(`${d}T00:00:00Z`));
  const x = scaleUtc().domain([xs[0], xs[xs.length - 1]]).range([PAD.l, W - PAD.r]);
  const y = scaleLinear().domain([0, 1]).range([height - PAD.b, PAD.t]);
  const data = rows.map((r) => Object.fromEntries(layers.map((l) => [l.key, r[l.key] ?? 0])));
  const valid = rows.map((r) => layers.some((l) => r[l.key] !== null && r[l.key] !== undefined));
  const series = stack<Record<string, number>>().keys(layers.map((l) => l.key))(data as any);
  const gen = area<any>().defined((_, i) => valid[i]).x((_, i) => x(xs[i])).y0((d) => y(d[0])).y1((d) => y(d[1]));
  const last = rows.length - 1;
  return (
    <svg viewBox={`0 0 ${W} ${height}`} className="h-auto w-full" role="img" aria-label={title}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#d27a2c" opacity="0.35" /><line x1="0" y1="0" x2="0" y2="6" stroke="#d27a2c" strokeWidth="2.4" />
        </pattern>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} stroke="rgba(20,24,27,0.08)" />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#4a5156" fontFamily="var(--font-plex)">{Math.round(t * 100)}%</text>
        </g>
      ))}
      {x.ticks(6).map((t) => <text key={t.toISOString()} x={x(t)} y={height - 10} textAnchor="middle" fontSize="11" fill="#4a5156" fontFamily="var(--font-plex)">{t.toISOString().slice(0, 7)}</text>)}
      {series.map((s, i) => (
        <path key={layers[i].key} d={gen(s as any) ?? ""} fill={layers[i].pattern ? "url(#hatch)" : layers[i].color} stroke="#fbf9f4" strokeWidth={0.4} />
      ))}
      {series.map((s, i) => {
        const d = s[last];
        if (!d || d[1] - d[0] < 0.035) return null;
        return <text key={layers[i].key} x={W - PAD.r + 8} y={y((d[0] + d[1]) / 2) + 4} fontSize="12" fontWeight={600} fill={layers[i].color === "#c9d0d4" || layers[i].color === "#a7b0b5" ? "#4a5156" : layers[i].color === "#e7c9a5" ? "#9a5212" : layers[i].color} fontFamily="var(--font-instrument)">{layers[i].label}</text>;
      })}
    </svg>
  );
}
