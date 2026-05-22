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
  onRequestSong: (station: Station) => void;
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
  onRequestSong,
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

          <div className="trackNowPlaying">
            <div className={`trackArtwork ${nowPlaying.art ? "trackArtworkLoaded" : ""}`} aria-hidden="true">
              {nowPlaying.art ? <img src={nowPlaying.art} alt="" loading="lazy" /> : <span>{getArtworkInitial(track)}</span>}
            </div>
            <div className="trackTitle" aria-label={track.label}>
              <strong className="trackTitleText">{track.title}</strong>
              {track.artist ? (
                <span className="trackArtist">{track.artist}</span>
              ) : null}
              {track.album ? (
                <span className="trackAlbum">{track.album}</span>
              ) : null}
            </div>
          </div>
          {nowPlaying.error && !nowPlaying.text ? <em>{nowPlaying.error}</em> : null}

          <div className="stationScheduleLine">
            <span>{t("station.liveNow")}</span>
            <strong>{liveNowText}</strong>
          </div>

          <div className="stationActions">
            <button
              className={`actionButton stationCommandButton ${isScheduleSelected ? "actionButtonActive" : ""}`}
              type="button"
              onClick={() => onSelectSchedule(station)}
            >
              {t("station.schedule")}
            </button>
            <button className="actionButton stationCommandButton requestActionButton" type="button" onClick={() => onRequestSong(station)}>
              {t("station.requestSong")}
            </button>
            {showAdminSkip ? (
              <button
                className="adminActionButton stationCommandButton"
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
  title: string;
  artist?: string;
  album?: string;
  label: string;
}

function getTrackDetails(
  nowPlaying: StationNowPlayingState,
  t: ReturnType<typeof useI18n>["t"]
): TrackDetails {
  if (nowPlaying.artist || nowPlaying.title) {
    const title = nowPlaying.title ?? nowPlaying.text ?? nowPlaying.artist ?? t("track.unavailable");
    const label = [title, nowPlaying.artist, nowPlaying.album].filter(Boolean).join(" - ");

    return {
      title,
      artist: nowPlaying.artist,
      album: nowPlaying.album,
      label
    };
  }

  if (nowPlaying.text) {
    const parts = nowPlaying.text.split(" - ").map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 3) {
      const [artist, album, ...songParts] = parts;
      const title = songParts.join(" - ");

      return {
        title,
        artist,
        album,
        label: nowPlaying.text
      };
    }

    if (parts.length === 2) {
      const [artist, title] = parts;

      return {
        title,
        artist,
        label: nowPlaying.text
      };
    }

    return {
      title: nowPlaying.text,
      label: nowPlaying.text
    };
  }

  if (nowPlaying.isLoading) {
    return {
      title: t("track.waiting"),
      label: t("track.waiting")
    };
  }

  return {
    title: t("track.unavailable"),
    label: t("track.unavailable")
  };
}

function getArtworkInitial(track: TrackDetails): string {
  return (track.title || track.artist || "?").trim().charAt(0).toUpperCase() || "?";
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
