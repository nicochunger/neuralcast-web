import { fetchScheduleForDay } from "@/lib/schedule";
import { getStation } from "@/lib/stations";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{
    stationId: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { stationId } = await context.params;
  const station = getStation(stationId);

  if (!station) {
    return NextResponse.json({ error: "Unknown station." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;

  try {
    const schedule = await fetchScheduleForDay(station, date);
    return NextResponse.json(schedule, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load schedule.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
