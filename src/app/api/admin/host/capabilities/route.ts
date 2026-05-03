import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getHostAdminCapabilities, isHostAdminConfigured } from "@/lib/hostAdmin";

export async function GET() {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isHostAdminConfigured()) {
    return NextResponse.json({ error: "Host admin API is not configured." }, { status: 503 });
  }

  try {
    const capabilities = await getHostAdminCapabilities();
    return NextResponse.json(capabilities, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load host admin capabilities.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
