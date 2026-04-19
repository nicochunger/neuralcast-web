import type { PlaybackState, Station, StationNowPlayingState } from "@/types/radio";

interface MiniPlayerProps {
  station: Station;
  playbackState: PlaybackState;
  nowPlaying: StationNowPlayingState;
  onPlay: (station: Station) => void;
  onStop: () => void;
}

export function MiniPlayer({ station, playbackState, nowPlaying, onPlay, onStop }: MiniPlayerProps) {
  const isPlaying = playbackState === "playing" || playbackState === "buffering";
  const track = nowPlaying.text ?? "Live stream";

  return (
    <aside className={`miniPlayer ${isPlaying ? "miniPlayerVisible" : ""}`} aria-live="polite">
      <img src={station.artworkImage} alt="" className="miniArtwork" />
      <div>
        <span>{station.name}</span>
        <strong>{track}</strong>
      </div>
      <button className="miniButton" type="button" onClick={() => (isPlaying ? onStop() : onPlay(station))}>
        {isPlaying ? "Stop" : "Play"}
      </button>
    </aside>
  );
}
