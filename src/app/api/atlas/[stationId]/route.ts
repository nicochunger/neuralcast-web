import { NextResponse } from "next/server";
import { proxyAtlasGet } from "@/lib/atlas";
import { isStationId } from "@/lib/stations";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{
    stationId: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { stationId } = await context.params;
  if (!isStationId(stationId)) {
    return NextResponse.json(
      { error: "Unknown station." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }

  return proxyAtlasGet(`public/atlas/${stationId}`, stationId, request);
}
