export type CompanionArchetype = "news" | "concert_check" | "short_story" | "album_spotlight" | "era_snapshot" | "deep_dive" | "episode";

export interface HostCompanion {
  id: string;
  channel: string;
  archetype: CompanionArchetype;
  expected_start: number;
  expected_end: number;
  expires_at: number;
  transcript: string;
  episode?: { media_id: string; duration: number; chapters: EpisodeChapter[] };
  content: {
    title: string;
    summary: string;
    key_points: string[];
    items: Array<{
      headline?: string;
      artist?: string;
      venue?: string;
      city?: string;
      country?: string;
      event_date?: string;
      source_url?: string | null;
    }>;
    subject?: { artist: string; title: string; album?: string | null; year?: string | null };
  };
}

export interface EpisodeChapter {
  kind: "music" | "commentary";
  id: string;
  start: number;
  end: number;
  title: string;
  artist?: string;
  album?: string;
  year?: string;
  rationale?: string;
  art_url?: string | null;
  summary?: string;
  key_points?: string[];
  transcript?: string;
  sources?: { url: string; claim: string }[];
}

export interface PlaybackObservation { song_id: string; played_at: number; current: boolean }
