import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isHostAdminConfigured, submitScheduleGenerator } from "@/lib/hostAdmin";

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

  if (!station) {
    return NextResponse.json({ error: "Select a station first." }, { status: 422 });
  }

  try {
    const jobId = await submitScheduleGenerator({
      station,
      dryRun: body?.dryRun === true,
      forceApply: body?.forceApply === true,
      seedMode: typeof body?.seedMode === "string" ? body.seedMode.trim() : undefined,
      seedSalt: typeof body?.seedSalt === "string" ? body.seedSalt.trim() : undefined,
      weekStartDate: typeof body?.weekStartDate === "string" ? body.weekStartDate.trim() : undefined,
      openRatioMin: typeof body?.openRatioMin === "number" ? body.openRatioMin : undefined,
      openRatioMax: typeof body?.openRatioMax === "number" ? body.openRatioMax : undefined,
      minOpenSlots: typeof body?.minOpenSlots === "number" ? body.minOpenSlots : undefined,
      maxOpenSlots: typeof body?.maxOpenSlots === "number" ? body.maxOpenSlots : undefined,
      minBlockMinutes: typeof body?.minBlockMinutes === "number" ? body.minBlockMinutes : undefined,
      maxBlockMinutes: typeof body?.maxBlockMinutes === "number" ? body.maxBlockMinutes : undefined
    });
    return NextResponse.json({ jobId }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to start the schedule generator.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
