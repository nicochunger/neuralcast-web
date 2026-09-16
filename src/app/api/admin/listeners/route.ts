import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { AZURACAST_BASE_URL, STATIONS } from "@/lib/stations";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store" };
  if (!(await getAuthSession())?.user?.isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers });
  const params = new URL(request.url).searchParams;
  const channel = STATIONS.flatMap(station => station.hostChannels).find(channel => channel.id === params.get("channel"));
  const range = params.get("range") || "live";
  if (!channel || !["live", "1", "7", "30"].includes(range)) return NextResponse.json({ error: "Invalid channel or range." }, { status: 400, headers });
  const key = process.env.AZURACAST_ADMIN_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "Listener reports need AZURACAST_ADMIN_API_KEY configured on the server, with permission to view station reports." }, { status: 503, headers });
  const query = new URLSearchParams({ unique: "true" });
  if (range !== "live") {
    query.set("start", new Date(Date.now() - Number(range) * 86400000).toISOString());
    query.set("end", new Date().toISOString());
  }
  try {
    const response = await fetch(`${AZURACAST_BASE_URL}/api/station/${encodeURIComponent(channel.azuracastStationSlug)}/listeners?${query}`, {
      cache: "no-store", headers: { Accept: "application/json", Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const error = [401, 403].includes(response.status) ? "The AzuraCast API key does not have access to listener reports for this channel." : `AzuraCast listener reports are unavailable (HTTP ${response.status}).`;
      return NextResponse.json({ error }, { status: 502, headers });
    }
    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error("Unexpected listener response from AzuraCast.");
    return NextResponse.json({ listeners: data, fetchedAt: new Date().toISOString() }, { headers });
  } catch {
    return NextResponse.json({ error: "Could not load listener reports. Check AzuraCast connectivity and try again." }, { status: 502, headers });
  }
}
