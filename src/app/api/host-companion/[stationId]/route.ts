import { getHostCompanion, isHostAdminConfigured } from "@/lib/hostAdmin";
import { getDefaultHostChannel, getHostChannel, getStation } from "@/lib/stations";
import { NextResponse } from "next/server";

interface RouteContext { params: Promise<{ stationId: string }> }

export async function GET(request: Request, context: RouteContext) {
  const { stationId } = await context.params;
  const station = getStation(stationId);
  const headers = { "Cache-Control": "no-store" };
  if (!station) return NextResponse.json({ error: "Unknown station." }, { status: 404, headers });
  const channelId = new URL(request.url).searchParams.get("channel");
  const channel = channelId ? getHostChannel(station, channelId) : getDefaultHostChannel(station);
  if (!channel) return NextResponse.json({ error: "Unknown host channel." }, { status: 404, headers });
  if (!isHostAdminConfigured()) return NextResponse.json({ card: null }, { headers });
  try {
    return NextResponse.json({ card: await getHostCompanion(channel.id) }, { headers });
  } catch {
    return NextResponse.json({ card: null }, { status: 503, headers });
  }
}
