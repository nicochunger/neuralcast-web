"use client";

import { getSegmentTitle, getStationDescription, useI18n } from "@/lib/i18n";
import type { CSSProperties } from "react";
import type {
  PlaybackState,
  Station,
  StationNowPlayingState,
  StationScheduleState
} from "@/types/radio";

interface StationCardProps {
  station: Station;
  isActive: boolean;
  playbackState: PlaybackState;
  nowPlaying: StationNowPlayingState;
  schedule: StationScheduleState;
  isScheduleSelected: boolean;
  onPlay: (station: Station) => void;
  onStop: () => void;
  onSelectSchedule: (station: Station) => void;
  showAdminSkip: boolean;
  isSkippingTrack: boolean;
  onSkipTrack: (station: Station) => void;
}

export function StationCard({
  station,
  isActive,
  playbackState,
  nowPlaying,
  schedule,
  isScheduleSelected,
  onPlay,
  onStop,
  onSelectSchedule,
  showAdminSkip,
  isSkippingTrack,
  onSkipTrack
}: StationCardProps) {
  const { locale, t } = useI18n();
  const isBusy = isActive && playbackState === "buffering";
  const isOnAir = isActive && playbackState === "playing";
  const shouldStop = isActive && (playbackState === "playing" || playbackState === "buffering");
  const statusLabel = getStatusLabel(isActive, playbackState, t);
  const track = getTrackDetails(nowPlaying, t);
  const listenerText =
    nowPlaying.listeners === undefined
      ? t("common.listenersUnknown")
      : t("common.listeners", { count: nowPlaying.listeners });
  const liveNowText = schedule.error ? t("common.unavailable") : getSegmentTitle(schedule.liveSegment, locale);

  return (
    <article
      className={`stationCard ${isActive ? "stationCardActive" : ""}`}
      style={
        {
          "--station-bg": `url(${station.backgroundImage})`,
          "--station-accent": station.accentColor
        } as CSSProperties
      }
    >
      <div className="stationCardInner">
        <div className="stationCardHeader">
          <div className="stationTitleBlock">
            <h2>{station.name}</h2>
            <p>{getStationDescription(station.id, t)}</p>
          </div>

          <div className="stationControlGroup">
            {isActive && playbackState !== "idle" ? (
              <span className={`stateChip ${isOnAir ? "stateChipLive" : ""} ${isBusy ? "stateChipBusy" : ""}`}>
                {isOnAir ? <WaveformBars /> : null}
                {statusLabel}
              </span>
            ) : null}
            <button
              className="playButton"
              type="button"
              onClick={() => (shouldStop ? onStop() : onPlay(station))}
              aria-label={`${shouldStop ? t("common.stop") : t("common.play")} ${station.name}`}
            >
              <span className={shouldStop ? "stopGlyph" : "playGlyph"} aria-hidden="true" />
              {shouldStop ? t("common.stop") : t("common.play")}
            </button>
          </div>
        </div>

        <div className="stationInfoSurface">
          <div className="stationMetaTopline">
            <span>{t("station.nowPlaying")}</span>
            <span>{listenerText}</span>
          </div>

          <div className="trackTitle" aria-label={track.label}>
            <strong className="trackArtist">{track.artist}</strong>
            {track.song ? <span className="trackSong">{track.song}</span> : null}
          </div>
          {nowPlaying.error && !nowPlaying.text ? <em>{nowPlaying.error}</em> : null}

          <div className="stationScheduleLine">
            <span>{t("station.liveNow")}</span>
            <strong>{liveNowText}</strong>
          </div>

          <div className="stationActions">
            <button
              className={`actionButton ${isScheduleSelected ? "actionButtonActive" : ""}`}
              type="button"
              onClick={() => onSelectSchedule(station)}
            >
              {t("station.schedule")}
            </button>
            {showAdminSkip ? (
              <button
                className="adminActionButton"
                type="button"
                onClick={() => onSkipTrack(station)}
                disabled={isSkippingTrack}
              >
                {isSkippingTrack ? "Skipping..." : "Skip song"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function getStatusLabel(
  isActive: boolean,
  playbackState: PlaybackState,
  t: ReturnType<typeof useI18n>["t"]
): string {
  if (!isActive) {
    return t("status.ready");
  }

  switch (playbackState) {
    case "buffering":
      return t("status.buffering");
    case "playing":
      return t("status.onAir");
    case "paused":
      return t("status.paused");
    case "error":
      return t("status.streamError");
    default:
      return t("status.ready");
  }
}

interface TrackDetails {
  artist: string;
  song?: string;
  label: string;
}

function getTrackDetails(
  nowPlaying: StationNowPlayingState,
  t: ReturnType<typeof useI18n>["t"]
): TrackDetails {
  if (nowPlaying.text) {
    const parts = nowPlaying.text.split(" - ").map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 3) {
      const [artist, ...songParts] = parts;
      const song = songParts.join(" - ");

      return {
        artist,
        song,
        label: nowPlaying.text
      };
    }

    if (parts.length === 2) {
      const [artist, song] = parts;

      return {
        artist,
        song,
        label: nowPlaying.text
      };
    }

    return {
      artist: nowPlaying.text,
      label: nowPlaying.text
    };
  }

  if (nowPlaying.isLoading) {
    return {
      artist: t("track.waiting"),
      label: t("track.waiting")
    };
  }

  return {
    artist: t("track.unavailable"),
    label: t("track.unavailable")
  };
}

function WaveformBars() {
  return (
    <span className="waveformBars" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
