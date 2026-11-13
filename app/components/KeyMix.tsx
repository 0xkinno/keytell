"use client";
import { StackChart } from "./StackChart";
import weekly from "@/lib/generated/weekly.json";

const LAYERS = [
  { key: "fc", label: "Function-call key", color: "#d27a2c" },
  { key: "delegated", label: "Meta tx (relayed)", color: "#e7c9a5", pattern: true },
  { key: "implicit", label: "Implicit account", color: "#c9d0d4" },
  { key: "full", label: "Full-access key", color: "#a7b0b5" },
  { key: "unknown", label: "Unknown", color: "#b8442f" },
];

export function KeyMix() {
  const w = (weekly as any[]).filter((x) => x.window !== "forward");
  const rows = w.map((x) => ({ fc: x.fc_only_share, delegated: x.delegated_share, implicit: x.implicit_share, full: x.full_share, unknown: x.unknown_share }));
  return (
    <figure>
      <StackChart dates={w.map((x) => x.monday)} rows={rows} layers={LAYERS} title="Weekly share of sampled NEAR mainnet transactions by the kind of key that signed them" />
      <figcaption className="mono mt-3 text-[12px] text-[color:var(--ink-2)]">Source: 60 random blocks and 200 random transactions per week from the FastNEAR block archive; keys read by view_access_key (now, or at the block before signing). Meta transactions are classified by the user's inner signature and shown hatched.</figcaption>
    </figure>
  );
}
