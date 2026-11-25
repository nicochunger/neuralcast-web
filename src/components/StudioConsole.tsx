"use client";

import { useMemo, type CSSProperties } from "react";
import { getSegmentTitle, getStationDescription, useI18n } from "@/lib/i18n";
import { AnimatedSuccessIcon } from "@/components/AnimatedSuccessIcon";
import { HeartIcon } from "@/components/HeartIcon";
import { HostLanguagePicker } from "@/components/HostLanguagePicker";
import { ScrollingTrackTitle } from "@/components/ScrollingTrackTitle";
import { TrackProgressBar } from "@/components/TrackProgressBar";
import type { ArtworkLightboxData } from "@/components/ArtworkLightbox";
import type {
  PlaybackState,
  PlayedTrack,
  ScheduleSegment,
  Station,
  StationId,
  StationNowPlayingState,
  StationScheduleState
} from "@/types/radio";

interface StudioConsoleProps {
  stations: readonly Station[];
  selectedStationId: StationId;
  activeStationId: StationId;
  playbackState: PlaybackState;
  currentTime: number;
  volume: number;
  nowPlayingByStation: Record<StationId, StationNowPlayingState>;
  schedulesByStation: Record<StationId, StationScheduleState>;
  hasHostRecapByStation: Record<StationId, boolean>;
  isFavorite: boolean;
  isScheduleSelected: boolean;
  isRequestSelected: boolean;
  isRecapSelected: boolean;
  hostSelection: string;
  showAdminSkip: boolean;
  isSkippingTrack: boolean;
  hasSkippedTrack: boolean;
  onSelectStation: (stationId: StationId) => void;
  onPlay: (station: Station) => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onHostSelectionChange: (station: Station, selection: string) => void;
  onToggleFavorite: () => void;
  onSelectHistory: (station: Station) => void;
  onSelectSchedule: (station: Station) => void;
  onRequestSong: (station: Station) => void;
  onSelectRecap: (station: Station) => void;
  onOpenArtwork: (station: Station, artwork: ArtworkLightboxData) => void;
  onSkipTrack: (station: Station) => void;
}

export function StudioConsole({
  stations,
  selectedStationId,
  activeStationId,
  playbackState,
  currentTime,
  volume,
  nowPlayingByStation,
  schedulesByStation,
  hasHostRecapByStation,
  isFavorite,
  isScheduleSelected,
  isRequestSelected,
  isRecapSelected,
  hostSelection,
  showAdminSkip,
  isSkippingTrack,
  hasSkippedTrack,
  onSelectStation,
  onPlay,
  onStop,
  onVolumeChange,
  onToggleMute,
  onHostSelectionChange,
  onToggleFavorite,
  onSelectHistory,
  onSelectSchedule,
  onRequestSong,
  onSelectRecap,
  onOpenArtwork,
  onSkipTrack
}: StudioConsoleProps) {
  const { locale, t } = useI18n();
  const station = stations.find((item) => item.id === selectedStationId) ?? stations[0];
  const nowPlaying = nowPlayingByStation[station.id];
  const schedule = schedulesByStation[station.id];
  const hasHostRecap = hasHostRecapByStation[station.id];

  const isAudioTarget = station.id === activeStationId;
  const isBusy = isAudioTarget && playbackState === "buffering";
  const isOnAir = isAudioTarget && playbackState === "playing";
  const shouldStop = isOnAir || isBusy;

  const track = getTrackDetails(nowPlaying, t);
  const canFavorite = Boolean(nowPlaying.title || nowPlaying.artist || nowPlaying.text);
  const listenerText =
    nowPlaying.listeners === undefined
      ? t("common.listenersUnknown")
      : t("common.listeners", { count: nowPlaying.listeners });
  const liveBlockText = schedule.error ? t("common.unavailable") : getSegmentTitle(schedule.liveSegment, locale);
  const upNextBlockText = schedule.upNextSegment ? getSegmentTitle(schedule.upNextSegment, locale) : undefined;
  const recentTracks = (nowPlaying.history ?? []).slice(0, 5);

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: station.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }),
    [locale, station.timeZone]
  );

  return (
    <section
      className={`studioWorkspace studioTheme-${station.id}`}
      aria-label={t("stations.ariaLabel")}
      style={{ "--station-accent": station.accentColor } as CSSProperties}
    >
      {/* Dual-Channel Radio Tuner Bar */}
      <div className="tunerStrip" role="tablist" aria-label={t("stations.ariaLabel")}>
        {stations.map((candidate, index) => {
          const candidatePlaying = nowPlayingByStation[candidate.id];
          const candidateTrack = getTrackDetails(candidatePlaying, t);
          const candidateSelected = candidate.id === station.id;
          const candidateLive =
            candidate.id === activeStationId && (playbackState === "playing" || playbackState === "buffering");
          const candidateListeners =
            candidatePlaying.listeners === undefined
              ? t("common.listenersUnknown")
              : t("common.listeners", { count: candidatePlaying.listeners });

          return (
            <button
              key={candidate.id}
              type="button"
              role="tab"
              aria-selected={candidateSelected}
              className={`tunerPreset tunerPreset-${candidate.id} ${candidateSelected ? "tunerPresetSelected" : ""} ${candidateLive ? "tunerPresetLive" : ""}`}
              style={
                {
                  "--preset-accent": candidate.accentColor,
                  "--preset-bg": `url(${candidate.backgroundImage})`
                } as CSSProperties
              }
              onClick={() => onSelectStation(candidate.id)}
            >
              <span className="tunerPresetThumb" aria-hidden="true">
                {candidatePlaying.art ? (
                  <img src={candidatePlaying.art} alt="" loading="lazy" />
                ) : (
                  <img src={candidate.artworkImage} alt="" loading="lazy" />
                )}
              </span>
              <span className="tunerPresetBody">
                <span className="tunerPresetTop">
                  <strong className="tunerPresetName">{candidate.name}</strong>
                  <span className="tunerPresetChannel">{`CH 0${index + 1}`}</span>
                </span>
                <span className="tunerPresetTrack">
                  {candidateTrack.artist ? `${candidateTrack.title} · ${candidateTrack.artist}` : candidateTrack.title}
                </span>
                <span className="tunerPresetMeta">{candidateListeners}</span>
              </span>
              {candidateLive ? (
                <span className="tunerPresetLiveWave" aria-label={t("status.onAir")}>
                  <WaveformBars />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Main Asymmetric Broadcast Console */}
      <div className="studioConsoleGrid">
        {/* Left: Primary Active Station Deck */}
        <article
          className={`studioDeck studioDeck-${station.id} ${isOnAir || isBusy ? "studioDeckOnAir" : ""}`}
          style={{ "--station-bg": `url(${station.backgroundImage})` } as CSSProperties}
        >
          <div className="studioDeckHeader">
            <div className="studioDeckIdentity">
              <h2>{station.name}</h2>
              <p>{getStationDescription(station.id, t)}</p>
            </div>
            <div className="studioDeckHeaderMeta">
              <span className="studioListenerReadout">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H3v7h4v-7H4Zm16 0h1v7h-4v-7h3Z" />
                </svg>
                {listenerText}
              </span>
              {station.hostChannels.length > 1 ? (
                <HostLanguagePicker
                  station={station}
                  selection={hostSelection}
                  onChange={(selection) => onHostSelectionChange(station, selection)}
                />
              ) : null}
            </div>
          </div>

          <div className="studioStageBody">
            <div className="studioArtworkColumn">
              {nowPlaying.art ? (
                <button
                  className="studioArtworkFrame studioArtworkButton"
                  type="button"
                  onClick={() =>
                    onOpenArtwork(station, {
                      imageUrl: nowPlaying.art as string,
                      title: track.title,
                      artist: track.artist,
                      album: track.album
                    })
                  }
                  aria-label={t("artwork.view")}
                  title={t("artwork.view")}
                >
                  <img src={nowPlaying.art} alt="" loading="lazy" />
                </button>
              ) : (
                <div className="studioArtworkFrame studioArtworkFallback" aria-hidden="true">
                  <span>{getArtworkInitial(track)}</span>
                </div>
              )}
            </div>

            <div className="studioTrackColumn">
              <div className="studioNowPlayingLabel">
                <span>{t("station.nowPlaying")}</span>
                <span className="studioProgramDivider" aria-hidden="true">/</span>
                <strong>{liveBlockText}</strong>
              </div>

              <div className="studioTrackCopy" aria-label={track.label}>
                <ScrollingTrackTitle title={track.title} />
                {track.artist ? <p className="studioTrackArtist">{track.artist}</p> : null}
                {track.album ? <p className="studioTrackAlbum">{track.album}</p> : null}
              </div>

              <TrackProgressBar nowPlaying={nowPlaying} currentTime={currentTime} />

              {nowPlaying.error && !nowPlaying.text ? <p className="studioTrackError">{nowPlaying.error}</p> : null}

              <div className="studioTransportRow">
                <button
                  className={`studioPlayButton ${isOnAir ? "studioPlayButtonOnAir" : ""} ${isBusy ? "studioPlayButtonBuffering" : ""}`}
                  type="button"
                  onClick={() => (shouldStop ? onStop() : onPlay(station))}
                  aria-label={`${shouldStop ? t("common.stop") : t("common.play")} ${station.name}`}
                >
                  {isOnAir || isBusy ? (
                    <WaveformBars />
                  ) : (
                    <span className={shouldStop ? "stopGlyph" : "playGlyph"} aria-hidden="true" />
                  )}
                  <span>{shouldStop ? t("common.stop") : t("common.play")}</span>
                </button>

                <button
                  className={`studioFavoriteButton ${isFavorite ? "studioFavoriteButtonActive" : ""}`}
                  type="button"
                  onClick={onToggleFavorite}
                  disabled={!canFavorite}
                  aria-pressed={isFavorite}
                  aria-label={isFavorite ? t("favorites.unlike") : t("favorites.like")}
                  title={isFavorite ? t("favorites.unlike") : t("favorites.like")}
                >
                  <HeartIcon filled={isFavorite} />
                </button>

                <div
                  className="studioVolumeControl"
                  style={{ "--volume-level": `${Math.round(volume * 100)}%` } as CSSProperties}
                >
                  <button
                    className="studioVolumeButton"
                    type="button"
                    onClick={onToggleMute}
                    aria-label={volume === 0 ? t("player.unmute") : t("player.mute")}
                    title={volume === 0 ? t("player.unmute") : t("player.mute")}
                  >
                    <VolumeIcon volume={volume} />
                  </button>
                  <input
                    className="studioVolumeSlider"
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={Math.round(volume * 100)}
                    onChange={(event) => onVolumeChange(Number(event.currentTarget.value) / 100)}
                    aria-label={t("player.volume")}
                    aria-valuetext={t("player.volumeValue", { value: Math.round(volume * 100) })}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="studioDeckFooter">
            <button
              className={`studioActionLink ${isRequestSelected ? "studioActionLinkActive" : ""}`}
              type="button"
              onClick={() => onRequestSong(station)}
              aria-expanded={isRequestSelected}
            >
              <StudioIcon icon="request" />
              <span>{t("station.requestSong")}</span>
            </button>
            <button
              className={`studioActionLink ${isScheduleSelected ? "studioActionLinkActive" : ""}`}
              type="button"
              onClick={() => onSelectSchedule(station)}
              aria-expanded={isScheduleSelected}
            >
              <StudioIcon icon="schedule" />
              <span>{t("station.schedule")}</span>
            </button>
            <button
              className={`studioActionLink ${hasHostRecap ? "studioActionLinkHighlight" : ""} ${isRecapSelected ? "studioActionLinkActive" : ""}`}
              type="button"
              onClick={() => {
                if (hasHostRecap) onSelectRecap(station);
              }}
              aria-disabled={!hasHostRecap}
              aria-haspopup="dialog"
              aria-expanded={isRecapSelected}
              aria-label={hasHostRecap ? t("companion.available") : t("companion.unavailable")}
              title={hasHostRecap ? t("companion.available") : t("companion.unavailable")}
            >
              <StudioIcon icon="recap" />
              <span>{t("companion.button")}</span>
              {hasHostRecap ? <span className="studioRecapDot" aria-hidden="true" /> : null}
            </button>
            {showAdminSkip ? (
              <button
                className={`studioActionLink studioActionLinkAdmin ${hasSkippedTrack ? "studioActionLinkSuccess" : ""}`}
                type="button"
                onClick={() => onSkipTrack(station)}
                disabled={isSkippingTrack}
                aria-live="polite"
              >
                {hasSkippedTrack ? <AnimatedSuccessIcon /> : <StudioIcon icon="skip" />}
                <span>
                  {hasSkippedTrack
                    ? t("station.skippedSong")
                    : isSkippingTrack
                      ? t("station.skippingSong")
                      : t("station.skipSong")}
                </span>
              </button>
            ) : null}
          </div>
        </article>

        {/* Right: Live Context Rail (Program Schedule + Recently Played) */}
        <aside className="studioRail" aria-label={station.name}>
          <section className="studioRailPanel">
            <div className="studioRailHeader">
              <h3>{t("station.schedule")}</h3>
              <button
                type="button"
                className="studioRailMore"
                onClick={() => onSelectSchedule(station)}
              >
                {t("schedule.title", { station: station.name })} →
              </button>
            </div>
            <div className="studioProgramList">
              <div className="studioProgramRow studioProgramRowLive">
                <div className="studioProgramHeader">
                  <span className="studioProgramRole">{t("schedule.summary.liveNow")}</span>
                  {formatSegmentWindow(schedule.liveSegment, timeFormatter) ? (
                    <span className="studioProgramTime">
                      {formatSegmentWindow(schedule.liveSegment, timeFormatter)}
                    </span>
                  ) : null}
                </div>
                <strong className="studioProgramTitle">{liveBlockText}</strong>
              </div>
              {upNextBlockText ? (
                <div className="studioProgramRow">
                  <div className="studioProgramHeader">
                    <span className="studioProgramRole">{t("schedule.summary.upNext")}</span>
                    {formatSegmentWindow(schedule.upNextSegment, timeFormatter) ? (
                      <span className="studioProgramTime">
                        {formatSegmentWindow(schedule.upNextSegment, timeFormatter)}
                      </span>
                    ) : null}
                  </div>
                  <strong className="studioProgramTitle">{upNextBlockText}</strong>
                </div>
              ) : null}
            </div>
          </section>

          <section className="studioRailPanel studioHistoryPanel">
            <div className="studioRailHeader">
              <h3>{t("station.recentlyPlayed")}</h3>
              <button
                type="button"
                className="studioRailMore"
                onClick={() => onSelectHistory(station)}
              >
                {t("station.recentlyPlayed")} →
              </button>
            </div>
            {recentTracks.length === 0 ? (
              <p className="studioRailEmpty">
                {nowPlaying.isLoading ? `${t("common.loading")}...` : t("history.empty")}
              </p>
            ) : (
              <ol className="studioRecentList">
                {recentTracks.map((item) => (
                  <RecentTrackRow key={item.id} track={item} formatter={timeFormatter} fallbackTitle={t("track.unavailable")} />
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}

function RecentTrackRow({
  track,
  formatter,
  fallbackTitle
}: {
  track: PlayedTrack;
  formatter: Intl.DateTimeFormat;
  fallbackTitle: string;
}) {
  const title = track.title ?? track.text ?? track.artist ?? fallbackTitle;
  const playedAt = track.playedAt === undefined ? undefined : new Date(track.playedAt * 1000);
  const timeText = playedAt && Number.isFinite(playedAt.getTime()) ? formatter.format(playedAt) : "--:--";

  return (
    <li className="studioRecentRow">
      <div className="studioRecentArt" aria-hidden="true">
        {track.art ? <img src={track.art} alt="" loading="lazy" /> : <span>{title.trim().charAt(0).toUpperCase() || "?"}</span>}
      </div>
      <div className="studioRecentCopy">
        <strong>{title}</strong>
        {track.artist ? <span>{track.artist}</span> : null}
      </div>
      <time className="studioRecentTime" dateTime={playedAt?.toISOString()}>
        {timeText}
      </time>
    </li>
  );
}

function StudioIcon({ icon }: { icon: "history" | "schedule" | "request" | "recap" | "skip" }) {
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
  if (icon === "recap") {
    return (
      <span className="stationActionIcon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M5 4h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-6 4V6a2 2 0 0 1 2-2Z" />
          <path d="M7 9h10M7 13h7" />
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
    return { title, artist: nowPlaying.artist, album: nowPlaying.album, label };
  }
  if (nowPlaying.text) {
    const parts = nowPlaying.text.split(" - ").map((part) => part.trim()).filter(Boolean);
    if (parts.length >= 3) {
      const [artist, album, ...songParts] = parts;
      return { title: songParts.join(" - "), artist, album, label: nowPlaying.text };
    }
    if (parts.length === 2) {
      const [artist, title] = parts;
      return { title, artist, label: nowPlaying.text };
    }
    return { title: nowPlaying.text, label: nowPlaying.text };
  }
  if (nowPlaying.isLoading) {
    return { title: t("track.waiting"), label: t("track.waiting") };
  }
  return { title: t("track.unavailable"), label: t("track.unavailable") };
}

function getArtworkInitial(track: TrackDetails): string {
  return (track.title || track.artist || "?").trim().charAt(0).toUpperCase() || "?";
}

function formatSegmentWindow(
  segment: ScheduleSegment | undefined,
  formatter: Intl.DateTimeFormat
): string | undefined {
  if (!segment) return undefined;
  const start = new Date(segment.startTime);
  const end = new Date(segment.endTime);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
    return undefined;
  }
  return `${formatter.format(start)}–${formatter.format(end)}`;
}
