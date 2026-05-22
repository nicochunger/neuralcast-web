import type { PlaybackState, StationId, StationNowPlayingState } from "@/types/radio";

export interface PersistentPlayerState {
  activeStationId: StationId;
  playbackState: PlaybackState;
  nowPlaying?: StationNowPlayingState;
}

type Listener = (state: PersistentPlayerState) => void;

interface PersistentPlayerGlobal {
  audioElement: HTMLAudioElement | null;
  state: PersistentPlayerState | null;
  listeners: Set<Listener>;
}

declare global {
  interface Window {
    __neuralcastPersistentPlayer__?: PersistentPlayerGlobal;
  }
}

const fallbackStore: PersistentPlayerGlobal = {
  audioElement: null,
  state: null,
  listeners: new Set<Listener>()
};

function getStore(): PersistentPlayerGlobal {
  if (typeof window === "undefined") {
    return fallbackStore;
  }

  if (!window.__neuralcastPersistentPlayer__) {
    window.__neuralcastPersistentPlayer__ = {
      audioElement: null,
      state: null,
      listeners: new Set<Listener>()
    };
  }

  return window.__neuralcastPersistentPlayer__;
}

export function getPersistentAudioElement(): HTMLAudioElement {
  const store = getStore();

  if (!store.audioElement) {
    store.audioElement = new Audio();
    store.audioElement.preload = "none";
  }

  return store.audioElement;
}

export function setPersistentPlayerState(nextState: PersistentPlayerState) {
  const store = getStore();
  store.state = nextState;
  store.listeners.forEach((listener) => listener(nextState));
}

export function getPersistentPlayerState() {
  return getStore().state;
}

export function subscribePersistentPlayer(listener: Listener) {
  const store = getStore();
  store.listeners.add(listener);
  if (store.state) {
    listener(store.state);
  }

  return () => {
    store.listeners.delete(listener);
  };
}
