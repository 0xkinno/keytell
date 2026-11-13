import type { Metadata } from "next";
import { MemoView } from "./MemoView";

export const metadata: Metadata = { title: "The analyst memo · Keytell" };

export default function Memo() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 pt-10 sm:px-6">
      <p className="eyebrow no-print">Brief 05 · The deliverable</p>
      <h1 className="display no-print mt-3 max-w-4xl text-[44px] sm:text-[64px]">A memo the analyst signs.</h1>
      <p className="no-print mt-5 max-w-3xl text-[18px] leading-relaxed text-[color:var(--ink-2)]">The artifact an analyst already brings to committee is a memo. This one is generated from the results file, links every number to its source, says what would change the conclusion, and ends with the analyst&rsquo;s own signature. Keytell never says buy; the analyst decides.</p>
      <div className="mt-10"><MemoView /></div>
    </div>
  );
}
