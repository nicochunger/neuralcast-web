import type { PlaybackObservation } from "@/types/hostCompanion";
import { getHostCompanion, isHostAdminConfigured } from "@/lib/hostAdmin";
import { getDefaultHostChannel, getHostChannel, getStation } from "@/lib/stations";
import { NextResponse } from "next/server";

interface RouteContext { params: Promise<{ stationId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { stationId } = await context.params;
  const station = getStation(stationId);
  const headers = { "Cache-Control": "no-store" };
  if (!station) return NextResponse.json({ error: "Unknown station." }, { status: 404, headers });
  const search = new URL(request.url).searchParams;
  const channelId = search.get("channel");
  const channel = channelId ? getHostChannel(station, channelId) : getDefaultHostChannel(station);
  if (!channel) return NextResponse.json({ error: "Unknown host channel." }, { status: 404, headers });
  let observations: PlaybackObservation[] = [];
  try {
    const value: unknown = JSON.parse(search.get("playback") || "[]");
    if (!Array.isArray(value) || value.length > 9 || value.some((item) => !item || typeof item !== "object" || typeof item.song_id !== "string" || item.song_id.length > 100 || typeof item.played_at !== "number" || !Number.isFinite(item.played_at) || typeof item.current !== "boolean")) throw new Error("Invalid playback");
    observations = value;
  } catch { return NextResponse.json({ error: "Invalid playback observations." }, { status: 400, headers }); }
  if (!isHostAdminConfigured()) return NextResponse.json({ card: null }, { headers });
  try {
    return NextResponse.json({ card: await getHostCompanion(channel.id, observations) }, { headers });
  } catch {
    return NextResponse.json({ card: null }, { status: 503, headers });
  }
}
