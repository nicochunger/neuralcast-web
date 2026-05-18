import type { PlaybackState, StationId } from "@/types/radio";

export interface PersistentPlayerState {
  activeStationId: StationId;
  playbackState: PlaybackState;
  trackText?: string;
}

type Listener = (state: PersistentPlayerState) => void;

let audioElement: HTMLAudioElement | null = null;
let state: PersistentPlayerState | null = null;
const listeners = new Set<Listener>();

export function getPersistentAudioElement(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.preload = "none";
  }

  return audioElement;
}

export function setPersistentPlayerState(nextState: PersistentPlayerState) {
  state = nextState;
  listeners.forEach((listener) => listener(nextState));
}

export function getPersistentPlayerState() {
  return state;
}

export function subscribePersistentPlayer(listener: Listener) {
  listeners.add(listener);
  if (state) {
    listener(state);
  }

  return () => {
    listeners.delete(listener);
  };
}
