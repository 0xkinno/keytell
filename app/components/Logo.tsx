// The Keytell mark: a small key whose bow carries a notch, read as a tell.
export function Mark({ size = 32, title = "Keytell" }: { size?: number; title?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title || undefined}>
      <circle cx="11" cy="16" r="7.5" fill="none" stroke="#d27a2c" strokeWidth="3" />
      <circle cx="11" cy="16" r="2.2" fill="#d27a2c" />
      <path d="M18 16h12M26 16v5M22 16v3.5" stroke="#d27a2c" strokeWidth="3" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return <span className={`display text-[24px] !tracking-[-0.03em] ${className}`}>Keytell</span>;
}
