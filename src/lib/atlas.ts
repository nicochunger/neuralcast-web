import { NextResponse } from "next/server";
import type { AtlasErrorCode, StationAtlasPayload } from "@/types/atlas";
import type { StationId } from "@/types/radio";

const NETWORK_TIMEOUT_MS = 15_000;
const PLAYLIST_SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,99}$/;

export function isAtlasPlaylistSlug(value: string): boolean {
  return PLAYLIST_SLUG_PATTERN.test(value);
}

export function atlasSourceBase(): string | null {
  const base = process.env.HOST_ADMIN_BASE_URL?.trim();
  if (!base) {
    return null;
  }
  return `${base.replace(/\/$/, "")}/`;
}

function buildDegradedResponse(
  station: StationId,
  code: AtlasErrorCode,
  error: string
): NextResponse {
  return NextResponse.json(
    { error, code, station },
    {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff"
      }
    }
  );
}

export async function proxyAtlasGet(
  upstreamPath: string,
  station: StationId,
  request: Request
): Promise<NextResponse> {
  const base = atlasSourceBase();
  if (!base) {
    return buildDegradedResponse(
      station,
      "unconfigured",
      "Sonic Atlas service is not configured."
    );
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(upstreamPath, base);
  } catch {
    return buildDegradedResponse(
      station,
      "unavailable",
      "Sonic Atlas service URL is invalid."
    );
  }

  const upstreamHeaders = new Headers({ Accept: "application/json" });
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch) {
    upstreamHeaders.set("If-None-Match", ifNoneMatch);
  }

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: upstreamHeaders,
      cache: "no-store",
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS)
    });

    if (response.status === 304) {
      const headers = new Headers({
        "Cache-Control": response.headers.get("cache-control") ?? "public, max-age=120",
        "X-Content-Type-Options": "nosniff"
      });
      const etag = response.headers.get("etag");
      if (etag) {
        headers.set("ETag", etag);
      }
      return new NextResponse(null, { status: 304, headers });
    }

    if (response.status === 404) {
      return NextResponse.json(
        { error: "Atlas resource not found.", station },
        {
          status: 404,
          headers: {
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"
          }
        }
      );
    }

    if (!response.ok) {
      return buildDegradedResponse(
        station,
        "unavailable",
        "Sonic Atlas service is temporarily unavailable."
      );
    }

    const bodyText = await response.text();
    try {
      JSON.parse(bodyText);
    } catch {
      return buildDegradedResponse(
        station,
        "unavailable",
        "Sonic Atlas service returned invalid JSON."
      );
    }

    const headers = new Headers({
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": response.headers.get("cache-control") ?? "public, max-age=120",
      "X-Content-Type-Options": "nosniff"
    });
    const etag = response.headers.get("etag");
    if (etag) {
      headers.set("ETag", etag);
    }

    return new NextResponse(bodyText, { status: 200, headers });
  } catch {
    return buildDegradedResponse(
      station,
      "unavailable",
      "Sonic Atlas service is temporarily unavailable."
    );
  }
}

export async function getStationAtlas(station: StationId): Promise<{
  data: StationAtlasPayload | null;
  errorCode: AtlasErrorCode | null;
}> {
  const base = atlasSourceBase();
  if (!base) {
    return { data: null, errorCode: "unconfigured" };
  }

  try {
    const response = await fetch(new URL(`public/atlas/${station}`, base), {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS)
    });

    if (!response.ok) {
      return { data: null, errorCode: "unavailable" };
    }

    const payload = (await response.json()) as Partial<StationAtlasPayload> | null;
    if (
      !payload ||
      payload.station !== station ||
      !Array.isArray(payload.playlists) ||
      !Array.isArray(payload.bridges) ||
      !Array.isArray(payload.decades) ||
      !Array.isArray(payload.artists)
    ) {
      return { data: null, errorCode: "unavailable" };
    }

    return { data: payload as StationAtlasPayload, errorCode: null };
  } catch {
    return { data: null, errorCode: "unavailable" };
  }
}
