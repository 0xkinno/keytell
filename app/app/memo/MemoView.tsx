"use client";
import { useState } from "react";
import { Download, Printer, PenLine } from "lucide-react";
import memo from "@/lib/generated/memo.json";
import { signMemo, type Signed413 } from "@/lib/wallet";

/** A small Markdown renderer for the memo: headings, bullets, quotes, bold, code and links. */
function inline(s: string, key: string) {
  const parts: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    const t = m[0];
    if (t.startsWith("**")) parts.push(<strong key={`${key}-${i++}`}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith("`")) parts.push(<code key={`${key}-${i++}`} className="code">{t.slice(1, -1)}</code>);
    else { const mm = t.match(/\[([^\]]+)\]\(([^)]+)\)/)!; parts.push(<a key={`${key}-${i++}`} className="ulink text-[color:var(--copper-ink)]" href={mm[2]} target="_blank" rel="noreferrer">{mm[1]}</a>); }
    last = m.index + t.length;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts;
}

function Markdown({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let list: string[] = [];
  const flush = (k: number) => { if (list.length) { out.push(<ul key={`ul${k}`} className="mt-2 list-disc space-y-1.5 pl-5">{list.map((l, i) => <li key={i}>{inline(l, `l${k}${i}`)}</li>)}</ul>); list = []; } };
  text.split("\n").forEach((line, k) => {
    if (line.startsWith("- ")) { list.push(line.slice(2)); return; }
    flush(k);
    if (line.startsWith("# ")) out.push(<h1 key={k} className="display text-[34px] sm:text-[42px]">{line.slice(2)}</h1>);
    else if (line.startsWith("## ")) out.push(<h2 key={k} className="serif mt-7 text-[22px] font-semibold">{line.slice(3)}</h2>);
    else if (line.startsWith("> ")) out.push(<blockquote key={k} className="serif mt-3 border-l-4 border-[color:var(--copper)] pl-4 text-[19px] italic">{line.slice(2)}</blockquote>);
    else if (line.trim()) out.push(<p key={k} className="mt-2 leading-relaxed">{inline(line, `p${k}`)}</p>);
  });
  flush(9999);
  return <>{out}</>;
}

export function MemoView() {
  const m = memo as { markdown: string; sha256: string } | null;
  const [sig, setSig] = useState<Signed413 | null>(null);
  const [check, setCheck] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (!m) return <p className="plate p-6">The memo has not been generated yet (make analyze).</p>;
  const message = `Keytell analyst attestation. I have read the evidence against as well as the evidence for in memo sha256 ${m.sha256}. The decision is mine. ${new Date().toISOString().slice(0, 10)}`;

  async function sign() {
    setErr(null);
    try {
      const s = await signMemo(message);
      setSig(s);
      const r = await fetch("/api/memo-verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(s) });
      const j = await r.json();
      setCheck(j.ok ? `Verified by the server: the signature is valid and ${j.publicKey} is a full-access key of ${j.accountId}.` : `Not verified: ${j.reason}`);
    } catch (e) {
      const m = String((e as Error).message ?? e);
      setErr(/rejected/i.test(m) ? "Wallet selection closed. Nothing was signed." : m);
    }
  }

  const download = (name: string, body: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type }));
    a.download = name;
    a.click();
  };
  const signedMd = sig ? `${m.markdown}\nSigned by ${sig.accountId} with ${sig.publicKey}\n\nMessage: ${sig.message}\n\nRecipient: ${sig.recipient}; nonce (base64): ${sig.nonce}\n\nSignature (base64): ${sig.signature}\n` : m.markdown;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <article className="plate p-6 text-[16px] sm:p-10">
        <Markdown text={m.markdown} />
        {sig && (
          <div className="mt-6 rounded-lg border border-[color:var(--verdigris)] p-4 text-[13px]">
            <p className="font-semibold text-[color:var(--verdigris-ink)]">Signed by {sig.accountId}</p>
            <p className="mono mt-1 break-all">key {sig.publicKey}</p>
            <p className="mono mt-1 break-all">message: {sig.message}</p>
            <p className="mono mt-1 break-all">signature: {sig.signature}</p>
          </div>
        )}
        <p className="mono mt-6 break-all text-[11.5px] text-[color:var(--ink-2)]">Memo sha256 {m.sha256}</p>
      </article>
      <aside className="no-print space-y-3 lg:sticky lg:top-6 lg:self-start">
        <button type="button" className="btn btn-ink w-full" onClick={sign}><PenLine size={16} aria-hidden /> Sign as analyst (NEP-413)</button>
        <p className="text-[13px] text-[color:var(--ink-2)]">Your wallet signs a message, not a transaction: no fee, nothing sent on chain. The signature is your attestation that you read the evidence against. The server checks it against your account&rsquo;s full-access keys.</p>
        {check && <p className="text-[13px] font-semibold text-[color:var(--verdigris-ink)]" aria-live="polite">{check}</p>}
        {err && <p className="text-[13px] text-[color:var(--oxide-ink)]" aria-live="polite">{err}</p>}
        <button type="button" className="btn btn-line w-full" onClick={() => download(sig ? "keytell-memo-signed.md" : "keytell-memo.md", signedMd, "text/markdown")}><Download size={16} aria-hidden /> Markdown</button>
        <button type="button" className="btn btn-line w-full" onClick={() => window.print()}><Printer size={16} aria-hidden /> PDF (print)</button>
      </aside>
    </div>
  );
}
