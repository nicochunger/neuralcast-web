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
  const track = getMiniTrackText(nowPlaying) ?? t("common.liveStream");

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

function getMiniTrackText(nowPlaying: StationNowPlayingState): string | undefined {
  if (nowPlaying.artist && nowPlaying.title) {
    return `${nowPlaying.artist} - ${nowPlaying.title}`;
  }

  if (nowPlaying.text) {
    const parts = nowPlaying.text.split(" - ").map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 3) {
      const [artist, , ...titleParts] = parts;
      return `${artist} - ${titleParts.join(" - ")}`;
    }

    if (parts.length >= 2) {
      const [artist, ...titleParts] = parts;
      return `${artist} - ${titleParts.join(" - ")}`;
    }

    return nowPlaying.text;
  }

  return undefined;
}
