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
  const track = getTrackDetails(nowPlaying);
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

          <div className="trackTitle" aria-label={track.label}>
            <strong className="trackArtist">{track.artist}</strong>
            {track.song ? <span className="trackSong">{track.song}</span> : null}
            {track.album ? <span className="trackAlbum">{track.album}</span> : null}
          </div>
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

interface TrackDetails {
  artist: string;
  song?: string;
  album?: string;
  label: string;
}

function getTrackDetails(nowPlaying: StationNowPlayingState): TrackDetails {
  if (nowPlaying.text) {
    const parts = nowPlaying.text.split(" - ").map((part) => part.trim()).filter(Boolean);

    if (parts.length >= 3) {
      const [artist, album, ...songParts] = parts;
      const song = songParts.join(" - ");

      return {
        artist,
        song,
        album,
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
      artist: "Waiting for live metadata.",
      label: "Waiting for live metadata."
    };
  }

  return {
    artist: "Metadata unavailable.",
    label: "Metadata unavailable."
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
