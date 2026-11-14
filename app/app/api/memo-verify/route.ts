import { NextResponse } from "next/server";
import { JsonRpcProvider } from "near-api-js";
import { RPC } from "@/lib/config";
import { verifyAttestation } from "@/lib/memo-verify";

export const dynamic = "force-dynamic";

// Checks an analyst's NEP-413 memo attestation against their NEAR mainnet account (lib/memo-verify.ts).
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = await verifyAttestation(body, new JsonRpcProvider({ url: RPC.mainnet[0] }));
  if (v.ok) return NextResponse.json(v);
  return NextResponse.json({ ok: false, reason: v.reason }, { status: v.status });
}
