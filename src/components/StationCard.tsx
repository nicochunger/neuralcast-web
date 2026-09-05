"use client";

import { getSegmentTitle, getStationDescription, useI18n } from "@/lib/i18n";
import { AnimatedSuccessIcon } from "@/components/AnimatedSuccessIcon";
import { HeartIcon } from "@/components/HeartIcon";
import { TrackProgressBar } from "@/components/TrackProgressBar";
import type { ArtworkLightboxData } from "@/components/ArtworkLightbox";
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
  currentTime: number;
  nowPlaying: StationNowPlayingState;
  schedule: StationScheduleState;
  isHistorySelected: boolean;
  isScheduleSelected: boolean;
  isRequestSelected: boolean;
  onPlay: (station: Station) => void;
  hostSelection: string;
  onHostSelectionChange: (station: Station, selection: string) => void;
  onStop: () => void;
  onSelectHistory: (station: Station) => void;
  onSelectSchedule: (station: Station) => void;
  onRequestSong: (station: Station) => void;
  onOpenArtwork: (artwork: ArtworkLightboxData) => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  showAdminSkip: boolean;
  isSkippingTrack: boolean;
  hasSkippedTrack: boolean;
  onSkipTrack: (station: Station) => void;
}

export function StationCard({
  station,
  isActive,
  playbackState,
  currentTime,
  nowPlaying,
  schedule,
  isHistorySelected,
  isScheduleSelected,
  isRequestSelected,
  onPlay,
  hostSelection,
  onHostSelectionChange,
  onStop,
  onSelectHistory,
  onSelectSchedule,
  onRequestSong,
  onOpenArtwork,
  isFavorite,
  onToggleFavorite,
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
  const canFavorite = Boolean(nowPlaying.title || nowPlaying.artist || nowPlaying.text);
  const listenerText =
    nowPlaying.listeners === undefined
      ? t("common.listenersUnknown")
      : t("common.listeners", { count: nowPlaying.listeners });
  const activeBlockText = schedule.error ? t("common.unavailable") : getSegmentTitle(schedule.liveSegment, locale);

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
            {station.hostChannels.length > 1 ? (
              <div className="hostLanguageControl">
                <label htmlFor={`host-language-${station.id}`}>{t("host.language")}</label>
                <select
                  id={`host-language-${station.id}`}
                  value={hostSelection}
                  onChange={(event) => onHostSelectionChange(station, event.target.value)}
                >
                  <option value="follow-ui">{t("host.followAppLanguage")}</option>
                  <option value="auto">{t("host.auto")}</option>
                  {station.hostChannels.map((channel) => (
                    <option key={channel.id} value={channel.id}>
                      {getHostChannelLabel(channel.id, t)}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
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
            <span className="stationActiveBlock">
              <span>{t("station.activeBlock")}</span>
              <strong>{activeBlockText}</strong>
            </span>
          </div>

          <div className="trackNowPlaying">
            {nowPlaying.art ? (
              <button
                className="trackArtwork trackArtworkLoaded trackArtworkButton"
                type="button"
                onClick={() => onOpenArtwork({
                  imageUrl: nowPlaying.art as string,
                  title: track.title,
                  artist: track.artist,
                  album: track.album
                })}
                aria-label={t("artwork.view")}
                title={t("artwork.view")}
              >
                <img src={nowPlaying.art} alt="" loading="lazy" />
              </button>
            ) : (
              <div className="trackArtwork" aria-hidden="true">
                <span>{getArtworkInitial(track)}</span>
              </div>
            )}
            <div className="trackTitle" aria-label={track.label}>
              <strong className="trackTitleText">{track.title}</strong>
              {track.artist ? (
                <span className="trackArtist">{track.artist}</span>
              ) : null}
              {track.album ? (
                <span className="trackAlbum">{track.album}</span>
              ) : null}
              <TrackProgressBar nowPlaying={nowPlaying} currentTime={currentTime} />
            </div>
            <button
              className={`favoriteButton ${isFavorite ? "favoriteButtonActive" : ""}`}
              type="button"
              onClick={onToggleFavorite}
              disabled={!canFavorite}
              aria-pressed={isFavorite}
              aria-label={isFavorite ? t("favorites.unlike") : t("favorites.like")}
              title={isFavorite ? t("favorites.unlike") : t("favorites.like")}
            >
              <HeartIcon filled={isFavorite} />
            </button>
          </div>
          {nowPlaying.error && !nowPlaying.text ? <em>{nowPlaying.error}</em> : null}

          <div className="stationActions">
            <button
              className={`actionButton stationCommandButton ${isHistorySelected ? "actionButtonActive" : ""}`}
              type="button"
              onClick={() => onSelectHistory(station)}
              aria-expanded={isHistorySelected}
            >
              <StationActionIcon icon="history" />
              {t("station.recentlyPlayed")}
            </button>
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

function getHostChannelLabel(
  channelId: string,
  t: ReturnType<typeof useI18n>["t"]
): string {
  switch (channelId) {
    case "neuralforge-es":
      return t("host.spanishArgentinian");
    case "neuralforge-fr":
      return t("host.frenchSwiss");
    case "neuralcast-es":
      return t("host.spanishArgentinian");
    default:
      return channelId;
  }
}

function StationActionIcon({ icon }: { icon: "history" | "schedule" | "request" | "skip" }) {
  if (icon === "history") {
    return (
      <span className="stationActionIcon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <path d="M3 4v5h5" />
          <path d="M12 7v5l3 2" />
        </svg>
      </span>
    );
  }

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
