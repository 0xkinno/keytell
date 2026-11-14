"use client";
import { MotionConfig } from "motion/react";

/** Honours the visitor's reduced-motion setting for every motion animation (entries, the Key Wall swing). */
export function MotionPrefs({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
