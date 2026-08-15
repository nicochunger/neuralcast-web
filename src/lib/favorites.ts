import { isStationId } from "@/lib/stations";
import type { FavoriteTrack, StationId, StationNowPlayingState } from "@/types/radio";

export const FAVORITES_STORAGE_KEY = "neuralcast:favorites";

export function createFavoriteTrack(
  stationId: StationId,
  nowPlaying: StationNowPlayingState
): FavoriteTrack | null {
  const rawText = cleanString(nowPlaying.text);
  const textParts = rawText?.split(" - ").map((part) => part.trim()).filter(Boolean) ?? [];
  const inferredArtist = cleanString(nowPlaying.artist) ?? (textParts.length >= 2 ? textParts[0] : undefined);
  const inferredTitle = cleanString(nowPlaying.title) ?? (textParts.length >= 2 ? textParts.slice(1).join(" - ") : undefined);
  const track = {
    artist: inferredArtist,
    title: inferredTitle,
    album: cleanString(nowPlaying.album),
    genre: cleanString(nowPlaying.genre),
    text: rawText,
    art: cleanString(nowPlaying.art)
  };

  if (!track.title && !track.artist && !track.text) {
    return null;
  }

  return {
    ...track,
    id: getFavoriteTrackId(stationId, track),
    stationId,
    likedAt: Date.now()
  };
}

export function getFavoriteTrackId(
  stationId: StationId,
  track: Pick<FavoriteTrack, "text" | "artist" | "title" | "album">
): string {
  const structuredIdentity = [track.artist, track.title, track.album]
    .map((value) => normalizeIdentityPart(value))
    .filter(Boolean);
  const identity = (structuredIdentity.length > 0 ? structuredIdentity : [normalizeIdentityPart(track.text)])
    .filter(Boolean)
    .join("|");

  return `${stationId}:${identity || "unknown"}`;
}

export function normalizeFavorites(value: unknown): FavoriteTrack[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const byId = new Map<string, FavoriteTrack>();

  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== "string" || !isStationIdValue(entry.stationId)) {
      continue;
    }

    const title = cleanString(entry.title);
    const artist = cleanString(entry.artist);
    const text = cleanString(entry.text);

    if (!title && !artist && !text) {
      continue;
    }

    const favorite: FavoriteTrack = {
      id: entry.id,
      stationId: entry.stationId,
      likedAt: toTimestamp(entry.likedAt),
      title,
      artist,
      album: cleanString(entry.album),
      genre: cleanString(entry.genre),
      text,
      art: cleanString(entry.art)
    };

    byId.set(favorite.id, favorite);
  }

  return Array.from(byId.values()).sort((left, right) => right.likedAt - left.likedAt);
}

export function getFavoriteTitle(track: Pick<FavoriteTrack, "title" | "text" | "artist">, fallback: string): string {
  return track.title ?? track.text ?? track.artist ?? fallback;
}

function isStationIdValue(value: unknown): value is StationId {
  return typeof value === "string" && isStationId(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cleanString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeIdentityPart(value: string | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

function toTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}
