"use client";
import { useEffect } from "react";

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let lenis: { raf(t: number): void; destroy(): void } | null = null;
    let id = 0;
    import("lenis").then(({ default: Lenis }) => {
      lenis = new Lenis({ lerp: 0.12 }) as never;
      const loop = (t: number) => { lenis?.raf(t); id = requestAnimationFrame(loop); };
      id = requestAnimationFrame(loop);
    });
    return () => { cancelAnimationFrame(id); lenis?.destroy(); };
  }, []);
  return null;
}
