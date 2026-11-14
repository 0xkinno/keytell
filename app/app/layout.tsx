import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fraunces, instrument, plexMono } from "./fonts";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { SmoothScroll } from "@/components/SmoothScroll";
import { MotionPrefs } from "@/components/MotionPrefs";

export const metadata: Metadata = {
  title: "Keytell: count the small keys, not the accounts",
  description: "A pre-registered test of whether transactions signed by NEAR function-call keys lead real usage better than daily active accounts or price. Every number rebuilds from public data with one command.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#0b1013", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${instrument.variable} ${plexMono.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[color:var(--ink)] focus:px-4 focus:py-2 focus:text-white">Skip to content</a>
        <SmoothScroll />
        <MotionPrefs>
          <Nav />
          <main id="main">{children}</main>
          <Footer />
        </MotionPrefs>
      </body>
    </html>
  );
}
