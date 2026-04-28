import type { Station, StationNowPlayingState } from "@/types/radio";

interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function updateMediaSession(
  station: Station,
  status: StationNowPlayingState | undefined,
  isPlaying: boolean
): void {
  if (!supportsMediaSession()) {
    return;
  }

  const title = status?.text ?? station.name;
  const artist = status?.artist ?? station.name;

  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist,
    album: "NeuralCast",
    artwork: [
      { src: station.artworkImage, sizes: "1024x1024", type: "image/webp" },
      { src: "/icons/neuralcast-icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  });
  navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
}

export function registerMediaSessionHandlers(handlers: MediaSessionHandlers): void {
  if (!supportsMediaSession()) {
    return;
  }

  setHandler("play", handlers.onPlay);
  setHandler("pause", handlers.onPause);
  setHandler("stop", handlers.onStop);
}

export function clearMediaSessionPlaybackState(): void {
  if (supportsMediaSession()) {
    navigator.mediaSession.playbackState = "none";
  }
}

function supportsMediaSession(): boolean {
  return typeof navigator !== "undefined" && "mediaSession" in navigator && "MediaMetadata" in window;
}

function setHandler(action: MediaSessionAction, handler: () => void): void {
  try {
    navigator.mediaSession.setActionHandler(action, handler);
  } catch {
    // Some browsers expose Media Session but do not support every action.
  }
}
