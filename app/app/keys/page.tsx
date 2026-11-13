import type { Metadata } from "next";
import { KeysLookup } from "./KeysLookup";

export const metadata: Metadata = { title: "Classify any account · Keytell" };

export default function Keys() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-10 sm:px-6">
      <p className="eyebrow">Brief 04 · Try your own</p>
      <h1 className="display mt-3 max-w-4xl text-[44px] sm:text-[64px]">Read any account&rsquo;s keys.</h1>
      <p className="mt-5 max-w-3xl text-[18px] leading-relaxed text-[color:var(--ink-2)]">Type a NEAR mainnet account. Keytell lists its access keys from public RPC, each marked function-call (scoped to one contract, unable to attach NEAR) or full access, and classifies its recent transactions by the key that signed them. This is the per-account version of the weekly sample. No wallet needed.</p>
      <div className="mt-10"><KeysLookup /></div>
    </div>
  );
}
