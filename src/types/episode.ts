import type { EpisodeChapter } from "@/types/hostCompanion";
import type { StationId } from "@/types/radio";

export interface PublishedEpisode {
  id: string;
  station: StationId;
  channel: string;
  language: string;
  episode_number?: number;
  title: string;
  description: string;
  published_at: string;
  duration: number;
  revision: string;
  audio_url: string;
  chapters?: EpisodeChapter[];
  transcript?: string;
}
