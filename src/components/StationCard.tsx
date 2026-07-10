"use client";

import { getSegmentTitle, getStationDescription, useI18n } from "@/lib/i18n";
import { AnimatedSuccessIcon } from "@/components/AnimatedSuccessIcon";
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
  isRequestSelected: boolean;
  onPlay: (station: Station) => void;
  onStop: () => void;
  onSelectSchedule: (station: Station) => void;
  onRequestSong: (station: Station) => void;
  showAdminSkip: boolean;
  isSkippingTrack: boolean;
  hasSkippedTrack: boolean;
  onSkipTrack: (station: Station) => void;
}

export function StationCard({
  station,
  isActive,
  playbackState,
  nowPlaying,
  schedule,
  isScheduleSelected,
  isRequestSelected,
  onPlay,
  onStop,
  onSelectSchedule,
  onRequestSong,
  showAdminSkip,
  isSkippingTrack,
  hasSkippedTrack,
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
  const activePlaylistText = schedule.error ? t("common.unavailable") : getActivePlaylistText(schedule.liveSegment, locale, t);

  return (
    <article
      className={`stationCard stationCard-${station.id} ${isActive ? "stationCardActive" : ""}`}
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
            <span className="listenerChip">{listenerText}</span>
          </div>

          <div className="stationControlGroup">
            <button
              className="playButton"
              type="button"
              onClick={() => (shouldStop ? onStop() : onPlay(station))}
              aria-label={`${shouldStop ? t("common.stop") : t("common.play")} ${station.name}`}
            >
              <span className={shouldStop ? "stopGlyph" : "playGlyph"} aria-hidden="true" />
              {shouldStop ? t("common.stop") : t("common.play")}
            </button>
            {isActive && playbackState !== "idle" ? (
              <span className={`stateChip ${isOnAir ? "stateChipLive" : ""} ${isBusy ? "stateChipBusy" : ""}`}>
                {isOnAir ? <WaveformBars /> : null}
                {statusLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="stationInfoSurface">
          <div className="stationMetaTopline">
            <span>{t("station.nowPlaying")}</span>
            <span className="stationActivePlaylists">
              <span>{t("station.activePlaylists")}</span>
              <strong>{activePlaylistText}</strong>
            </span>
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

          <div className="stationActions">
            <button
              className={`actionButton stationCommandButton ${isScheduleSelected ? "actionButtonActive" : ""}`}
              type="button"
              onClick={() => onSelectSchedule(station)}
              aria-expanded={isScheduleSelected}
            >
              <StationActionIcon icon="schedule" />
              {t("station.schedule")}
            </button>
            <button
              className={`actionButton stationCommandButton requestActionButton ${isRequestSelected ? "actionButtonActive" : ""}`}
              type="button"
              onClick={() => onRequestSong(station)}
              aria-expanded={isRequestSelected}
            >
              <StationActionIcon icon="request" />
              {t("station.requestSong")}
            </button>
            {showAdminSkip ? (
              <button
                className={`adminActionButton stationCommandButton ${hasSkippedTrack ? "adminActionButtonSuccess" : ""}`}
                type="button"
                onClick={() => onSkipTrack(station)}
                disabled={isSkippingTrack}
                aria-live="polite"
              >
                {hasSkippedTrack ? <AnimatedSuccessIcon /> : <StationActionIcon icon="skip" />}
                {hasSkippedTrack ? t("station.skippedSong") : isSkippingTrack ? t("station.skippingSong") : t("station.skipSong")}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function getActivePlaylistText(
  segment: StationScheduleState["liveSegment"],
  locale: ReturnType<typeof useI18n>["locale"],
  t: ReturnType<typeof useI18n>["t"]
): string {
  if (!segment) {
    return t("station.scheduleWaiting");
  }

  if (segment.kind === "open-rotation") {
    return getSegmentTitle(segment, locale);
  }

  if (segment.playlistNames.length > 0) {
    return segment.playlistNames.join(", ");
  }

  return getSegmentTitle(segment, locale);
}

function StationActionIcon({ icon }: { icon: "schedule" | "request" | "skip" }) {
  if (icon === "request") {
    return (
      <span className="stationActionIcon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M9 18V5l11-2v13" />
          <path d="M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z" />
          <path d="M20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z" />
        </svg>
      </span>
    );
  }

  if (icon === "skip") {
    return (
      <span className="stationActionIcon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="m5 5 8 7-8 7V5Z" />
          <path d="m13 5 8 7-8 7V5Z" />
        </svg>
      </span>
    );
  }

  return (
    <span className="stationActionIcon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        <path d="M7 3v3" />
        <path d="M17 3v3" />
        <path d="M4 8h16" />
        <path d="M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
        <path d="M8 12h3" />
        <path d="M8 16h6" />
      </svg>
    </span>
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
