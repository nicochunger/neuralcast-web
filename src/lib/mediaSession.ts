import type { PlaybackState, Station, StationNowPlayingState } from "@/types/radio";

interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

export function updateMediaSession(
  station: Station,
  status: StationNowPlayingState | undefined,
  playbackState: PlaybackState
): void {
  if (!supportsMediaSession()) {
    return;
  }

  const title = status?.title ?? status?.text ?? station.name;
  const artist = status?.artist ?? station.name;
  const album = status?.album ?? station.name;
  const artwork = status?.art
    ? [
        { src: status.art },
        { src: station.artworkImage, sizes: "1024x1024", type: "image/webp" }
      ]
    : [{ src: station.artworkImage, sizes: "1024x1024", type: "image/webp" }];

  navigator.mediaSession.metadata = new MediaMetadata({
    title,
    artist,
    album,
    artwork
  });
  navigator.mediaSession.playbackState = playbackState === "playing" ? "playing" : playbackState === "idle" ? "none" : "paused";
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
