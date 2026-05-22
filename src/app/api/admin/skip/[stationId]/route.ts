import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { skipCurrentTrack } from "@/lib/admin";
import { isStationId } from "@/lib/stations";

interface RouteContext {
  params: Promise<{
    stationId: string;
  }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const session = await getAuthSession();

  if (!session?.user?.isAdmin) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { stationId } = await context.params;

  if (!isStationId(stationId)) {
    return NextResponse.json({ error: "Unknown station." }, { status: 404 });
  }

  try {
    const message = await skipCurrentTrack(stationId);
    return NextResponse.json({ message }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to skip the current track.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
