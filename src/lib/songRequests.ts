import { AZURACAST_BASE_URL } from "@/lib/stations";
import type { RequestableSong, Station } from "@/types/radio";

type JsonObject = Record<string, unknown>;

export async function fetchRequestableSongs(station: Station): Promise<RequestableSong[]> {
  const response = await fetch(`${AZURACAST_BASE_URL}/api/station/${station.id}/requests`, {
    cache: "no-store",
    headers: {
      ...AZURACAST_PUBLIC_HEADERS
    }
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response, "Unable to load requestable songs."));
  }

  return normalizeRequestableSongs(await response.json());
}

export async function submitSongRequest(station: Station, requestUrl: string): Promise<string> {
  const url = resolveStationRequestUrl(station, requestUrl);
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      ...AZURACAST_PUBLIC_HEADERS,
      Referer: `${AZURACAST_BASE_URL}/public/${station.id}`
    }
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response, "Unable to submit song request."));
  }

  const body = await response.text();
  if (!body.trim()) {
    return "Your request has been submitted.";
  }

  let payload: unknown;
  try {
    payload = JSON.parse(body) as unknown;
  } catch {
    return "Your request has been submitted.";
  }

  const root = asObject(payload);
  const success = root.success === true;
  const message = readString(root.formatted_message) ?? readString(root.message);

  if (!success) {
    throw new Error(message ?? "Unable to submit song request.");
  }

  return message ?? "Your request has been submitted.";
}

function normalizeRequestableSongs(payload: unknown): RequestableSong[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload.flatMap((entry) => {
    const root = asObject(entry);
    const requestId = readString(root.request_id) ?? readString(root.id);
    const requestUrl = readString(root.request_url);
    const song = asObject(root.song);

    if (!requestId || !requestUrl) {
      return [];
    }

    const artist = readString(song.artist);
    const title = readString(song.title);
    const album = readString(song.album);
    const text = readString(song.text);

    return [
      {
        requestId,
        requestUrl,
        text,
        artist,
        title,
        album,
        genre: readString(song.genre),
        art: readString(song.art),
        displayText: formatDisplayText(artist, title, text)
      }
    ];
  });
}

function resolveStationRequestUrl(station: Station, requestUrl: string): string {
  let url: URL;

  try {
    url = new URL(requestUrl, AZURACAST_BASE_URL);
  } catch {
    throw new Error("Invalid song request URL.");
  }

  if (url.origin !== AZURACAST_BASE_URL) {
    throw new Error("Invalid song request URL.");
  }

  const expectedPrefix = `/api/station/${station.azuracastStationId}/request/`;
  const stationSlugPrefix = `/api/station/${station.id}/request/`;

  if (!url.pathname.startsWith(expectedPrefix) && !url.pathname.startsWith(stationSlugPrefix)) {
    throw new Error("Invalid song request URL for this station.");
  }

  return url.toString();
}

async function buildErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = await response.text();
  if (!body.trim()) {
    return fallback;
  }

  try {
    const payload = JSON.parse(body) as unknown;
    const root = asObject(payload);
    return readString(root.formatted_message) ?? readString(root.message) ?? fallback;
  } catch {
    return body
      .split("\n")[0]
      .replace(/^Error:/, "")
      .split(" on /")[0]
      .trim() || fallback;
  }
}

function formatDisplayText(artist?: string, title?: string, text?: string): string {
  if (artist && title) {
    return `${artist} - ${title}`;
  }

  return title ?? artist ?? text ?? "Unknown song";
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

const AZURACAST_PUBLIC_HEADERS = {
  Accept: "application/json",
  "Accept-Language": "en-US,en;q=0.9",
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 NeuralCastWebPWA/1.0"
};
