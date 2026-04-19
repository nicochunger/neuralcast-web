export type StationId = "neuralcast" | "neuralforge";

export type PlaybackState = "idle" | "buffering" | "playing" | "paused" | "error";

export type ScheduleSegmentKind = "scheduled" | "open-slot" | "open-rotation";

export interface Station {
  id: StationId;
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
  listeners?: number;
  fetchedAt: string;
}

export interface StationNowPlayingState extends Partial<StationNowPlaying> {
  stationId: StationId;
  isLoading: boolean;
  error?: string;
}

export interface ScheduleSegment {
  startTime: string;
  endTime: string;
  kind: ScheduleSegmentKind;
  playlistNames: string[];
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
