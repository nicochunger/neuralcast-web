"use client";

import { type CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import type { PlaybackState, Station, StationNowPlayingState } from "@/types/radio";

interface MiniPlayerProps {
  station: Station;
  playbackState: PlaybackState;
  nowPlaying: StationNowPlayingState;
  volume: number;
  onPlay: (station: Station) => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
}

export function MiniPlayer({
  station,
  playbackState,
  nowPlaying,
  volume,
  onPlay,
  onStop,
  onVolumeChange,
  onToggleMute
}: MiniPlayerProps) {
  const { t } = useI18n();
  const isPlaying = playbackState === "playing" || playbackState === "buffering";
  const track = getMiniTrackDetails(nowPlaying, t("common.liveStream"));
  const artwork = nowPlaying.art ?? station.artworkImage;

  return (
    <aside className={`miniPlayer ${isPlaying ? "miniPlayerVisible" : ""}`} aria-live="polite">
      <img src={artwork} alt="" className="miniArtwork" />
      <div className="miniTrack">
        <strong>{track.title}</strong>
        {track.artist ? <span>{track.artist}</span> : null}
      </div>
      <div
        className="volumeControl"
        style={{ "--volume-level": `${Math.round(volume * 100)}%` } as CSSProperties}
      >
        <button
          className="volumeButton"
          type="button"
          onClick={onToggleMute}
          aria-label={volume === 0 ? t("player.unmute") : t("player.mute")}
          title={volume === 0 ? t("player.unmute") : t("player.mute")}
        >
          <VolumeIcon volume={volume} />
        </button>
        <input
          className="volumeSlider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={Math.round(volume * 100)}
          onChange={(event) => onVolumeChange(Number(event.currentTarget.value) / 100)}
          aria-label={t("player.volume")}
          aria-valuetext={t("player.volumeValue", { value: Math.round(volume * 100) })}
        />
        <output className="volumeValue" aria-hidden="true">{Math.round(volume * 100)}</output>
      </div>
      <button className="miniButton" type="button" onClick={() => (isPlaying ? onStop() : onPlay(station))}>
        {isPlaying ? t("common.stop") : t("common.play")}
      </button>
    </aside>
  );
}

function VolumeIcon({ volume }: { volume: number }) {
  return (
    <svg className="volumeIcon" viewBox="0 0 24 24" focusable="false" aria-hidden="true">
      <path d="M11 5 6.8 8.5H3.5v7h3.3L11 19V5Z" />
      {volume === 0 ? (
        <>
          <path d="m15.5 9 5 6" />
          <path d="m20.5 9-5 6" />
        </>
      ) : (
        <>
          <path d="M15 9.2a4 4 0 0 1 0 5.6" />
          {volume > 0.5 ? <path d="M17.8 6.5a7.6 7.6 0 0 1 0 11" /> : null}
        </>
      )}
    </svg>
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
