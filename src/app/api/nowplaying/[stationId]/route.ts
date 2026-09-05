import { fetchNowPlaying } from "@/lib/azuracast";
import { getDefaultHostChannel, getHostChannel, getStation } from "@/lib/stations";
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

  try {
    const requestedChannelId = new URL(request.url).searchParams.get("channel") ?? undefined;
    const hostChannel =
      getHostChannel(station, requestedChannelId) ?? getDefaultHostChannel(station);
    const status = await fetchNowPlaying(station, hostChannel);
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
