import { segmentTitle } from "@/lib/schedule";
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
  onSelectSchedule
}: StationCardProps) {
  const isBusy = isActive && playbackState === "buffering";
  const isOnAir = isActive && playbackState === "playing";
  const shouldStop = isActive && (playbackState === "playing" || playbackState === "buffering");
  const statusLabel = getStatusLabel(isActive, playbackState);
  const trackText = getTrackText(nowPlaying);
  const listenerText =
    nowPlaying.listeners === undefined
      ? "Listeners: --"
      : `Listeners: ${nowPlaying.listeners}`;
  const liveNowText = schedule.error ? "Unavailable" : segmentTitle(schedule.liveSegment);

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
            <p>{station.id === "neuralcast" ? "Curated AI radio" : "Forged for heavy rotation"}</p>
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
              aria-label={`${shouldStop ? "Stop" : "Play"} ${station.name}`}
            >
              <span className={shouldStop ? "stopGlyph" : "playGlyph"} aria-hidden="true" />
              {shouldStop ? "Stop" : "Play"}
            </button>
          </div>
        </div>

        <div className="stationInfoSurface">
          <div className="stationMetaTopline">
            <span>Now playing</span>
            <span>{listenerText}</span>
          </div>

          <strong className="trackTitle">{trackText}</strong>
          {nowPlaying.error && !nowPlaying.text ? <em>{nowPlaying.error}</em> : null}

          <div className="stationScheduleLine">
            <span>Live now</span>
            <strong>{liveNowText}</strong>
          </div>

          <div className="stationActions">
            <button
              className={`actionButton ${isScheduleSelected ? "actionButtonActive" : ""}`}
              type="button"
              onClick={() => onSelectSchedule(station)}
            >
              Schedule
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function getStatusLabel(isActive: boolean, playbackState: PlaybackState): string {
  if (!isActive) {
    return "Ready";
  }

  switch (playbackState) {
    case "buffering":
      return "Buffering";
    case "playing":
      return "On air";
    case "paused":
      return "Paused";
    case "error":
      return "Stream error";
    default:
      return "Ready";
  }
}

function getTrackText(nowPlaying: StationNowPlayingState): string {
  if (nowPlaying.text) {
    return nowPlaying.text;
  }

  if (nowPlaying.isLoading) {
    return "Waiting for live metadata.";
  }

  return "Metadata unavailable.";
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
