import type { StationNowPlayingState } from "@/types/radio";

export interface TrackProgress {
  elapsedSeconds: number;
  durationSeconds: number;
  percentage: number;
}

export function getTrackProgress(
  nowPlaying: StationNowPlayingState,
  currentTimeMilliseconds: number
): TrackProgress | undefined {
  const playedAt = nowPlaying.playedAt;
  const durationSeconds = nowPlaying.duration;

  if (
    playedAt === undefined ||
    durationSeconds === undefined ||
    !Number.isFinite(playedAt) ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0 ||
    currentTimeMilliseconds <= 0
  ) {
    return undefined;
  }

  const elapsedSeconds = clamp(currentTimeMilliseconds / 1000 - playedAt, 0, durationSeconds);

  return {
    elapsedSeconds,
    durationSeconds,
    percentage: (elapsedSeconds / durationSeconds) * 100
  };
}

export function formatTrackTime(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
