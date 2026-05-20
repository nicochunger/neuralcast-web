import { AZURACAST_BASE_URL } from "@/lib/stations";
import type { Station, StationNowPlaying } from "@/types/radio";

type JsonObject = Record<string, unknown>;

export async function fetchNowPlaying(station: Station): Promise<StationNowPlaying> {
  const response = await fetch(`${AZURACAST_BASE_URL}/api/nowplaying/${station.id}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Now-playing request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  return normalizeNowPlaying(station, payload);
}

function normalizeNowPlaying(station: Station, payload: unknown): StationNowPlaying {
  const root = asObject(payload);
  const nowPlaying = asObject(root.now_playing);
  const song = asObject(nowPlaying.song);
  const stationPayload = asObject(root.station);
  const listeners = asObject(root.listeners);

  const artist = readString(song.artist);
  const title = readString(song.title);
  const album = readString(song.album);
  const text = readString(song.text) ?? formatTrack(artist, title);
  const stationName = readString(stationPayload.name) ?? station.name;
  const listenerCount = parseListenerCount(listeners);

  return {
    stationId: station.id,
    stationName,
    text,
    artist,
    title,
    album,
    genre: readString(song.genre),
    art: readString(song.art),
    listeners: listenerCount,
    fetchedAt: new Date().toISOString()
  };
}

function parseListenerCount(listeners: JsonObject): number | undefined {
  const current = parseNumber(listeners.current);
  const total = parseNumber(listeners.total);
  const value = current ?? total;
  return value === undefined ? undefined : Math.max(0, value);
}

function formatTrack(artist?: string, title?: string): string | undefined {
  if (artist && title) {
    return `${artist} - ${title}`;
  }

  return title ?? artist;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}
