import type { Metadata } from "next";
import { ProofRunner } from "./ProofRunner";

export const metadata: Metadata = { title: "Proof from chain · Keytell" };

export default function Proof() {
  return (
    <div className="mx-auto max-w-5xl px-4 pt-10 sm:px-6">
      <p className="eyebrow">For skeptics</p>
      <h1 className="display mt-3 text-[44px] sm:text-[64px]">Verify it yourself.</h1>
      <p className="mt-5 max-w-3xl text-[18px] leading-relaxed text-[color:var(--ink-2)]">Every check runs in your browser against public NEAR testnet RPC and files served with this site, which your browser hashes itself. A machine twin is at <a className="ulink" href="/proof.json">/proof.json</a>, and <span className="mono">make verify</span> recomputes every number from a clean clone with no keys.</p>
      <ProofRunner />
    </div>
  );
}
