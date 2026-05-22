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
  const track = getMiniTrackDetails(nowPlaying, t("common.liveStream"));
  const artwork = nowPlaying.art ?? station.artworkImage;

  return (
    <aside className={`miniPlayer ${isPlaying ? "miniPlayerVisible" : ""}`} aria-live="polite">
      <img src={artwork} alt="" className="miniArtwork" />
      <div>
        <strong>{track.title}</strong>
        {track.artist ? <span>{track.artist}</span> : null}
      </div>
      <button className="miniButton" type="button" onClick={() => (isPlaying ? onStop() : onPlay(station))}>
        {isPlaying ? t("common.stop") : t("common.play")}
      </button>
    </aside>
  );
}

interface MiniTrackDetails {
  title: string;
  artist?: string;
}

function getMiniTrackDetails(nowPlaying: StationNowPlayingState, fallbackTitle: string): MiniTrackDetails {
  if (nowPlaying.title) {
    return {
      title: nowPlaying.title,
      artist: nowPlaying.artist
    };
  }

  if (nowPlaying.text) {
    const parts = nowPlaying.text.split(" - ").map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 3) {
      const [artist, , ...titleParts] = parts;
      return {
        title: titleParts.join(" - "),
        artist
      };
    }

    if (parts.length >= 2) {
      const [artist, ...titleParts] = parts;
      return {
        title: titleParts.join(" - "),
        artist
      };
    }

    return {
      title: nowPlaying.text
    };
  }

  return {
    title: fallbackTitle
  };
}
