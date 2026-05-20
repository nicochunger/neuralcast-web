import { fetchRequestableSongs, submitSongRequest } from "@/lib/songRequests";
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
    const songs = await fetchRequestableSongs(station);
    return NextResponse.json({ songs }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load requestable songs.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { stationId } = await context.params;
  const station = getStation(stationId);

  if (!station) {
    return NextResponse.json({ error: "Unknown station." }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { requestUrl?: unknown };
  const requestUrl = typeof body.requestUrl === "string" ? body.requestUrl : "";

  if (!requestUrl) {
    return NextResponse.json({ error: "Select a song first." }, { status: 422 });
  }

  try {
    const message = await submitSongRequest(station, requestUrl);
    return NextResponse.json({ message }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit song request.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
