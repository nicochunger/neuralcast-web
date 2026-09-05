export type StationId = "neuralcast" | "neuralforge";

export type PlaybackState = "idle" | "buffering" | "playing" | "paused" | "error";

export type ScheduleSegmentKind = "scheduled" | "open-slot" | "open-rotation";

export interface Station {
  id: StationId;
  azuracastStationId: number;
  name: string;
  streamUrl: string;
  timeZone: string;
  backgroundImage: string;
  artworkImage: string;
  accentColor: string;
  openRotationThreshold?: number;
}

export interface StationNowPlaying {
  stationId: StationId;
  stationName: string;
  text?: string;
  artist?: string;
  title?: string;
  album?: string;
  genre?: string;
  art?: string;
  listeners?: number;
  playedAt?: number;
  duration?: number;
  history: PlayedTrack[];
  fetchedAt: string;
}

export interface StationNowPlayingState extends Partial<StationNowPlaying> {
  stationId: StationId;
  isLoading: boolean;
  error?: string;
}

export interface PlayedTrack {
  id: string;
  playedAt?: number;
  text?: string;
  artist?: string;
  title?: string;
  album?: string;
  genre?: string;
  art?: string;
}

export interface FavoriteTrack {
  id: string;
  stationId: StationId;
  likedAt: number;
  text?: string;
  artist?: string;
  title?: string;
  album?: string;
  genre?: string;
  art?: string;
}

export interface ScheduleSegment {
  startTime: string;
  endTime: string;
  kind: ScheduleSegmentKind;
  playlistNames: string[];
  presentation?: SchedulePresentationTranslations;
}

export interface SchedulePresentationCopy {
  title?: string;
  description: string;
}

export interface SchedulePresentationTranslations {
  en?: SchedulePresentationCopy;
  es?: SchedulePresentationCopy;
  fr?: SchedulePresentationCopy;
}

export interface StationSchedulePresentation {
  station: StationId;
  version: number;
  planHash: string;
  generatedAt: string;
  blocks: Array<{
    playlistNames: string[];
    translations: SchedulePresentationTranslations;
  }>;
}

export interface StationScheduleDay {
  stationId: StationId;
  date: string;
  timeZone: string;
  segments: ScheduleSegment[];
  liveSegment?: ScheduleSegment;
  upNextSegment?: ScheduleSegment;
  fetchedAt: string;
}

export interface StationScheduleState extends Partial<StationScheduleDay> {
  stationId: StationId;
  isLoading: boolean;
  error?: string;
}

export interface RequestableSong {
  requestId: string;
  requestUrl: string;
  text?: string;
  artist?: string;
  title?: string;
  album?: string;
  genre?: string;
  art?: string;
  displayText: string;
}

export interface SongRequestState {
  stationId?: StationId;
  stationName: string;
  isLoading: boolean;
  songs: RequestableSong[];
  submittingRequestId?: string;
  successfulRequestId?: string;
  error?: string;
}
