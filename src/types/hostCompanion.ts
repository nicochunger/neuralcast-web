export type CompanionArchetype = "news" | "concert_check" | "short_story" | "album_spotlight" | "era_snapshot" | "deep_dive";

export interface HostCompanion {
  id: string;
  channel: string;
  archetype: CompanionArchetype;
  expected_start: number;
  expected_end: number;
  expires_at: number;
  transcript: string;
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
