import { fetchNowPlaying } from "@/lib/azuracast";
import { getStation } from "@/lib/stations";
import { NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{
    stationId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  const { stationId } = await context.params;
  const station = getStation(stationId);

  if (!station) {
    return NextResponse.json({ error: "Unknown station." }, { status: 404 });
  }

  try {
    const status = await fetchNowPlaying(station);
    return NextResponse.json(status, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load metadata.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
