import { segmentTitle } from "@/lib/schedule";
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
      ? "Listeners pending"
      : `${nowPlaying.listeners} ${nowPlaying.listeners === 1 ? "listener" : "listeners"}`;

  return (
    <article
      className={`stationCard ${isActive ? "stationCardActive" : ""}`}
      style={
        {
          "--station-bg": `url(${station.backgroundImage})`,
          "--station-accent": station.accentColor
        } as React.CSSProperties
      }
    >
      <div className="stationImageWash" />
      <div className="stationCardInner">
        <div className="stationTopline">
          <span className={`stateChip ${isOnAir ? "stateChipLive" : ""} ${isBusy ? "stateChipBusy" : ""}`}>
            {statusLabel}
          </span>
          <span>{listenerText}</span>
        </div>

        <div className="stationIdentity">
          <img src={station.artworkImage} alt="" className="stationArtwork" loading="eager" />
          <div>
            <h2>{station.name}</h2>
            <p>{station.id === "neuralcast" ? "Curated AI radio" : "Heavy rotation from the forge"}</p>
          </div>
        </div>

        <div className="stationMeta">
          <span>Now playing</span>
          <strong>{trackText}</strong>
          {nowPlaying.error && !nowPlaying.text ? <em>{nowPlaying.error}</em> : null}
        </div>

        <div className="stationActions">
          <button
            className="primaryButton"
            type="button"
            onClick={() => (shouldStop ? onStop() : onPlay(station))}
            aria-label={`${shouldStop ? "Stop" : "Play"} ${station.name}`}
          >
            {shouldStop ? "Stop" : "Play"}
          </button>
          <button
            className={`secondaryButton ${isScheduleSelected ? "secondaryButtonActive" : ""}`}
            type="button"
            onClick={() => onSelectSchedule(station)}
          >
            Schedule
          </button>
        </div>

        <div className="stationScheduleLine">
          <span>Live now</span>
          <strong>{schedule.error ? "Unavailable" : segmentTitle(schedule.liveSegment)}</strong>
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
