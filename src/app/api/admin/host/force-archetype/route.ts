import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isHostAdminConfigured, submitForceArchetype } from "@/lib/hostAdmin";

export async function POST(request: Request) {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isHostAdminConfigured()) {
    return NextResponse.json({ error: "Host admin API is not configured." }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const station = typeof body?.station === "string" ? body.station.trim() : "";
  const archetype = typeof body?.archetype === "string" ? body.archetype.trim() : "";
  const trackFocus = typeof body?.trackFocus === "string" ? body.trackFocus.trim() : undefined;
  const dryRun = body?.dryRun === true;

  if (!station || !archetype) {
    return NextResponse.json({ error: "Select both a station and an archetype first." }, { status: 422 });
  }

  try {
    const jobId = await submitForceArchetype({ station, archetype, trackFocus, dryRun });
    return NextResponse.json({ jobId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start a forced host run.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
