import type { PublishedEpisode } from "@/types/episode";
import { isStationId } from "@/lib/stations";

const identifier = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export function episodeSourceBase(): string {
  const base = process.env.HOST_ADMIN_BASE_URL?.trim();
  if (!base) throw new Error("Episode service is not configured");
  return `${base.replace(/\/$/, "")}/`;
}

// Metadata is fetched by the Next server; audio and artwork travel directly from VPS to listener.
async function request(path: string) {
  const response = await fetch(new URL(`public/episodes${path}`, episodeSourceBase()), {
    cache: "no-store", signal: AbortSignal.timeout(15000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Episode service is temporarily unavailable");
  return response.json();
}

export function normalizeEpisode(value: PublishedEpisode): PublishedEpisode {
  if (!value || !isStationId(value.station) || !identifier.test(value.id) ||
      !/^[a-f0-9]{64}$/.test(value.revision) || !Number.isFinite(value.duration) || value.duration <= 0 ||
      typeof value.title !== "string" || typeof value.description !== "string") {
    throw new Error("Invalid episode metadata");
  }
  const prefix = `public/episodes/${value.station}/${value.id}`;
  // Never trust a stored arbitrary URL: media URLs are generated from the selected publication.
  return {
    ...value,
    audio_url: new URL(`${prefix}/audio`, episodeSourceBase()).href,
    chapters: value.chapters?.map((chapter) => ({ ...chapter,
      art_url: chapter.art_url && identifier.test(chapter.id)
        ? new URL(`${prefix}/art/${chapter.id}`, episodeSourceBase()).href : null
    }))
  };
}

export async function getEpisodes(): Promise<PublishedEpisode[]> {
  const payload = await request("");
  if (!payload || !Array.isArray(payload.episodes)) throw new Error("Invalid episode catalogue");
  return payload.episodes.map(normalizeEpisode);
}

export async function getEpisode(station: string, id: string): Promise<PublishedEpisode | null> {
  if (!isStationId(station) || !identifier.test(id)) return null;
  const payload = await request(`/${station}/${id}`);
  return payload ? normalizeEpisode(payload) : null;
}
