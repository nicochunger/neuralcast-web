"use client";

import { useI18n } from "@/lib/i18n";
import { formatTrackTime, getTrackProgress } from "@/lib/trackProgress";
import type { StationNowPlayingState } from "@/types/radio";
import type { CSSProperties } from "react";

interface TrackProgressBarProps {
  nowPlaying: StationNowPlayingState;
  currentTime: number;
}

export function TrackProgressBar({ nowPlaying, currentTime }: TrackProgressBarProps) {
  const { t } = useI18n();
  const progress = getTrackProgress(nowPlaying, currentTime);

  if (!progress) {
    return null;
  }

  const elapsed = formatTrackTime(progress.elapsedSeconds);
  const duration = formatTrackTime(progress.durationSeconds);

  return (
    <div className="trackProgress">
      <div
        className="trackProgressBar"
        role="progressbar"
        aria-label={t("player.trackProgress")}
        aria-valuemin={0}
        aria-valuemax={progress.durationSeconds}
        aria-valuenow={progress.elapsedSeconds}
        aria-valuetext={t("player.trackProgressValue", { elapsed, duration })}
        style={{ "--track-progress": `${progress.percentage}%` } as CSSProperties}
      />
      <div className="trackProgressTimes" aria-hidden="true">
        <span>{elapsed}</span>
        <span>{duration}</span>
      </div>
    </div>
  );
}
