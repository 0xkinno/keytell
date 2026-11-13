import type { Metadata } from "next";
import { LedgerLive } from "./LedgerLive";
import { BreakList } from "./BreakList";

export const metadata: Metadata = { title: "The on-chain claim · Keytell" };

export default function Ledger() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 sm:px-6">
      <p className="eyebrow">Brief 03 · On chain</p>
      <h1 className="display mt-3 max-w-4xl text-[44px] sm:text-[64px]">The claim, fixed before the data.</h1>
      <p className="mt-5 max-w-3xl text-[18px] leading-relaxed text-[color:var(--ink-2)]">Everything on this page is read live from NEAR testnet in your browser. The ledger is a keyless contract: once the claim was registered, nobody, including us, could change its statement, threshold or hashes.</p>
      <div className="mt-10"><LedgerLive /></div>
      <div className="mt-8"><BreakList /></div>
    </div>
  );
}
