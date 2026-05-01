"use client";

import { useI18n } from "@/lib/i18n";
import type { PlaybackState, Station, StationNowPlayingState } from "@/types/radio";

interface MiniPlayerProps {
  station: Station;
  playbackState: PlaybackState;
  nowPlaying: StationNowPlayingState;
  onPlay: (station: Station) => void;
  onStop: () => void;
}

export function MiniPlayer({ station, playbackState, nowPlaying, onPlay, onStop }: MiniPlayerProps) {
  const { t } = useI18n();
  const isPlaying = playbackState === "playing" || playbackState === "buffering";
  const track = nowPlaying.text ?? t("common.liveStream");

  return (
    <aside className={`miniPlayer ${isPlaying ? "miniPlayerVisible" : ""}`} aria-live="polite">
      <img src={station.artworkImage} alt="" className="miniArtwork" />
      <div>
        <span>{station.name}</span>
        <strong>{track}</strong>
      </div>
      <button className="miniButton" type="button" onClick={() => (isPlaying ? onStop() : onPlay(station))}>
        {isPlaying ? t("common.stop") : t("common.play")}
      </button>
    </aside>
  );
}
