"use client";
import { useEffect, useState } from "react";
import { view } from "@/lib/near";
import facts from "@/lib/generated/facts.json";

export interface LiveClaim { status: "Open" | "Passed" | "Failed"; posted: number; wins: number; source: "chain" | "committed" }

/** Reads the claim from the ledger on testnet; falls back to the committed record, labelled. */
export function useClaim(): LiveClaim | null {
  const f = facts as any;
  const [c, setC] = useState<LiveClaim | null>(null);
  useEffect(() => {
    if (!f.claim) return;
    let live = true;
    view<any>("testnet", f.claim.ledger, "get_claim", { claim_id: f.claim.id })
      .then((r) => live && r && setC({ status: r.status, posted: r.posted, wins: r.wins, source: "chain" }))
      .catch(() => live && setC({ status: f.claim.status_at_last_crank ?? "Open", posted: 0, wins: 0, source: "committed" }));
    return () => { live = false; };
  }, [f.claim]);
  return c;
}

export function ClaimStatusDot({ className = "" }: { className?: string }) {
  const c = useClaim();
  const color = c?.status === "Passed" ? "var(--verdigris)" : c?.status === "Failed" ? "var(--oxide)" : "var(--copper)";
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} aria-live="polite">
      <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 30%, transparent)` }} />
      {c ? `Forward claim ${c.status.toLowerCase()}${c.source === "chain" ? ` · ${c.posted} of 12 weeks posted` : " · committed record"}` : "Reading the ledger"}
    </span>
  );
}
