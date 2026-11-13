"use client";
import { useEffect, useState } from "react";

// A live UTC clock, rendered only after mount so server and client agree.
export function UtcClock({ className = "" }: { className?: string }) {
  const [t, setT] = useState<string | null>(null);
  useEffect(() => {
    const f = () => setT(new Date().toISOString().slice(11, 19));
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);
  return <span className={`mono ${className}`} suppressHydrationWarning>{t ?? "--:--:--"} UTC</span>;
}

/** Seconds until a nanosecond timestamp, ticking; null before mount. */
export function useSecondsUntil(ns: string | null): number | null {
  const [s, setS] = useState<number | null>(null);
  useEffect(() => {
    if (!ns) return;
    const target = Number(BigInt(ns) / 1_000_000n);
    const f = () => setS(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, [ns]);
  return s;
}
