import type { PublishedEpisode } from "@/types/episode";
import type { StationId } from "@/types/radio";
import { isStationId } from "@/lib/stations";

const identifier = /^[a-z0-9][a-z0-9_-]{0,79}$/;

export function formatEpisodeNumber(number: number): string {
  return `#${String(number).padStart(3, "0")}`;
}

export function formatEpisodeTitle(
  episode: Pick<PublishedEpisode, "title" | "episode_number">
): string {
  if (typeof episode.episode_number !== "number" || !Number.isInteger(episode.episode_number) || episode.episode_number < 1) {
    return episode.title;
  }
  const prefix = formatEpisodeNumber(episode.episode_number);
  if (episode.title.startsWith(`${prefix} `) || episode.title === prefix) {
    return episode.title;
  }
  return `${prefix} ${episode.title}`;
}

export function episodeSourceBase(): string {
  const base = process.env.HOST_ADMIN_BASE_URL?.trim();
  if (!base) throw new Error("Episode service is not configured");
  return `${base.replace(/\/$/, "")}/`;
}

export function podcastFeedUrl(station: StationId): string | undefined {
  try {
    return new URL(`public/podcasts/${station}/feed.xml`, episodeSourceBase()).href;
  } catch {
    return undefined;
  }
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
