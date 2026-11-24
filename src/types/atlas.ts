import type { StationId } from "@/types/radio";

export type RotationRole = "themed" | "open_only" | "reserved_window";

export type AtlasErrorCode = "unconfigured" | "unavailable";

export interface AtlasTopArtist {
  name: string;
  slug: string;
  track_count: number;
}

export interface AtlasSampleTrack {
  artist: string;
  title: string;
  album: string;
  year: number | null;
}

export interface AtlasPlaylistNode {
  slug: string;
  name: string;
  description: string;
  placement_notes: string;
  rotation_role: RotationRole;
  track_count: number;
  unique_artist_count: number;
  min_year: number | null;
  max_year: number | null;
  decades: Record<string, number>;
  top_artists: AtlasTopArtist[];
  episode_ids: string[];
  bridge_count: number;
  x: number;
  y: number;
}

export interface AtlasBridge {
  source: string;
  target: string;
  shared_count: number;
  jaccard: number;
  sample_tracks: AtlasSampleTrack[];
}

export interface AtlasDecadeBucket {
  decade: number;
  label: string;
  track_count: number;
  unique_track_count: number;
  top_playlists: Array<{ slug: string; name: string; count: number }>;
  top_artists: Array<{ name: string; slug: string; count: number }>;
}

export interface AtlasEpisodeRef {
  id: string;
  station: StationId;
  title: string;
  episode_number: number | null;
  description: string;
  published_at: string | null;
  duration: number | null;
  playlist_slugs: string[];
  matched_artists: string[];
}

export interface AtlasHostStory {
  archetype: string;
  title: string;
  summary: string;
  created_at: string | null;
  track_title: string | null;
}

export interface AtlasArtistTrack {
  artist: string;
  title: string;
  album: string;
  year: number | null;
  playlists: string[];
}

export interface AtlasArtistEntry {
  slug: string;
  name: string;
  track_count: number;
  min_year: number | null;
  max_year: number | null;
  playlists: string[];
  episode_ids: string[];
  host_stories: AtlasHostStory[];
  tracks: AtlasArtistTrack[];
}

export interface AtlasStats {
  playlist_count: number;
  total_entries: number;
  unique_tracks: number;
  unique_artists: number;
  bridge_count: number;
  min_year: number | null;
  max_year: number | null;
  episode_count: number;
}

export interface StationAtlasPayload {
  station: StationId;
  station_name: string;
  accent: string;
  generated_at: string;
  stats: AtlasStats;
  playlists: AtlasPlaylistNode[];
  bridges: AtlasBridge[];
  decades: AtlasDecadeBucket[];
  episodes: AtlasEpisodeRef[];
  artists: AtlasArtistEntry[];
}

export interface PlaylistDetailTrack {
  artist: string;
  artist_slug: string;
  title: string;
  album: string;
  year: number | null;
  decade: number | null;
  other_playlists: string[];
  episode_ids: string[];
}

export interface PlaylistDetailBridge {
  playlist_slug: string;
  playlist_name: string;
  shared_count: number;
  jaccard: number;
  sample_tracks: AtlasSampleTrack[];
}

export interface PlaylistDetailEpisode {
  id: string;
  station: StationId;
  title: string;
  episode_number: number | null;
  description: string;
  published_at: string | null;
  duration: number | null;
  matched_tracks: Array<{ artist: string; title: string }>;
}

export interface PlaylistDetailPayload {
  station: StationId;
  playlist: AtlasPlaylistNode;
  tracks: PlaylistDetailTrack[];
  bridges: PlaylistDetailBridge[];
  decades: Array<{ decade: number; label: string; track_count: number }>;
  episodes: PlaylistDetailEpisode[];
}
