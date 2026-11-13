import { NextResponse } from "next/server";
import { runChecks } from "@/lib/proof";

export const dynamic = "force-dynamic";

// The machine twin of /proof: the same checks, run on the server against public RPC, as JSON.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const r = await runChecks(origin);
  const passed = r.checks.filter((c) => c.ok).length;
  return NextResponse.json({ passed, total: r.checks.length, all_pass: passed === r.checks.length, at: r.at, checks: r.checks }, { headers: { "cache-control": "no-store" } });
}
