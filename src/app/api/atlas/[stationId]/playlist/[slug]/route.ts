import { NextResponse } from "next/server";
import { isAtlasPlaylistSlug, proxyAtlasGet } from "@/lib/atlas";
import { isStationId } from "@/lib/stations";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    stationId: string;
    slug: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { stationId, slug } = await context.params;
  if (!isStationId(stationId)) {
    return NextResponse.json(
      { error: "Unknown station." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!isAtlasPlaylistSlug(slug)) {
    return NextResponse.json(
      { error: "Invalid playlist slug." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  return proxyAtlasGet(`public/atlas/${stationId}/playlist/${slug}`, stationId, request);
}
