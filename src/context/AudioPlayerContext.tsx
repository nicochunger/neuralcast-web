"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { clearMediaSessionPlaybackState, registerMediaSessionHandlers, updateMediaSession } from "@/lib/mediaSession";
import { getPersistentAudioElement } from "@/lib/persistentAudio";
import { DEFAULT_STATION_ID, STATIONS, isStationId } from "@/lib/stations";
import type {
  PlaybackState,
  Station,
  StationId,
  StationNowPlaying,
  StationNowPlayingState,
  StationScheduleDay,
  StationScheduleState
} from "@/types/radio";

interface AudioPlayerContextValue {
  activeStationId: StationId;
  activeStation: Station;
  playbackState: PlaybackState;
  playbackError: string | undefined;
  currentTime: number;
  volume: number;
  nowPlaying: Record<StationId, StationNowPlayingState>;
  schedules: Record<StationId, StationScheduleState>;
  playStation: (station: Station) => Promise<void>;
  stopPlayback: () => void;
  reconnectPlayback: () => Promise<void>;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  refreshNowPlaying: (stationIds?: StationId[]) => Promise<void>;
  refreshSchedules: (stationIds?: StationId[]) => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);
const VOLUME_STORAGE_KEY = "neuralcast:volume";
const LAST_AUDIBLE_VOLUME_STORAGE_KEY = "neuralcast:last-audible-volume";
const DEFAULT_VOLUME = 1;
const RECOVERY_RETRY_DELAYS = [2000, 5000, 10000] as const;
const STALL_RECOVERY_DELAY = 8000;
const RECOVERY_WATCHDOG_DELAY = 12000;

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const manualStopRef = useRef(false);
  const lastAudibleVolumeRef = useRef(DEFAULT_VOLUME);
  const recoveryAttemptRef = useRef(0);
  const recoveryTimerRef = useRef<number | undefined>(undefined);
  const stallTimerRef = useRef<number | undefined>(undefined);
  const recoveryInFlightRef = useRef(false);
  const retryPlaybackRef = useRef<(() => Promise<void>) | undefined>(undefined);

  const [activeStationId, setActiveStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackError, setPlaybackError] = useState<string | undefined>();
  const [localTime, setLocalTime] = useState(0);
  const [serverTimeOffset, setServerTimeOffset] = useState(0);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);

  const [nowPlaying, setNowPlaying] = useState<Record<StationId, StationNowPlayingState>>(
    createInitialNowPlayingState
  );
  const [schedules, setSchedules] = useState<Record<StationId, StationScheduleState>>(
    createInitialScheduleState
  );

  useEffect(() => {
    let isMounted = true;

    const synchronizeServerTime = async () => {
      const requestStartedAt = Date.now();

      try {
        const response = await fetch("/api/time", { cache: "no-store" });
        const receivedAt = Date.now();

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { timestamp?: unknown };
        const timestamp = typeof payload.timestamp === "number" ? payload.timestamp : Number(payload.timestamp);

        if (isMounted && Number.isFinite(timestamp)) {
          const requestMidpoint = requestStartedAt + (receivedAt - requestStartedAt) / 2;
          setServerTimeOffset(timestamp * 1000 - requestMidpoint);
        }
      } catch {
        // Track progress falls back to the browser clock if server time is unavailable.
      }
    };

    void synchronizeServerTime();
    const syncInterval = window.setInterval(synchronizeServerTime, 600000);

    return () => {
      isMounted = false;
      window.clearInterval(syncInterval);
    };
  }, []);

  useEffect(() => {
    const updateLocalTime = () => setLocalTime(Date.now());
    updateLocalTime();
    const clockInterval = window.setInterval(updateLocalTime, 1000);

    return () => window.clearInterval(clockInterval);
  }, []);

  const currentTime = localTime + serverTimeOffset;

  const activeStation = useMemo(
    () => STATIONS.find((station) => station.id === activeStationId) ?? STATIONS[0],
    [activeStationId]
  );
  const activeNowPlaying = nowPlaying[activeStationId];

  const getAudioElement = useCallback(() => {
    audioRef.current = getPersistentAudioElement();
    return audioRef.current;
  }, []);

  const setVolume = useCallback((nextVolume: number) => {
    const normalizedVolume = Math.min(1, Math.max(0, nextVolume));
    const audio = getAudioElement();

    audio.volume = normalizedVolume;
    setVolumeState(normalizedVolume);

    if (normalizedVolume > 0) {
      lastAudibleVolumeRef.current = normalizedVolume;
      window.localStorage.setItem(LAST_AUDIBLE_VOLUME_STORAGE_KEY, String(normalizedVolume));
    }
    window.localStorage.setItem(VOLUME_STORAGE_KEY, String(normalizedVolume));
  }, [getAudioElement]);

  const toggleMute = useCallback(() => {
    setVolume(volume > 0 ? 0 : lastAudibleVolumeRef.current);
  }, [setVolume, volume]);

  const clearRecoveryTimers = useCallback(() => {
    if (recoveryTimerRef.current !== undefined) {
      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = undefined;
    }

    if (stallTimerRef.current !== undefined) {
      window.clearTimeout(stallTimerRef.current);
      stallTimerRef.current = undefined;
    }
  }, []);

  const queueRecovery = useCallback((delay: number, replaceExisting = false) => {
    if (manualStopRef.current || recoveryInFlightRef.current) {
      return;
    }

    if (recoveryTimerRef.current !== undefined) {
      if (!replaceExisting) {
        return;
      }

      window.clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = undefined;
    }

    recoveryTimerRef.current = window.setTimeout(() => {
      recoveryTimerRef.current = undefined;
      void retryPlaybackRef.current?.();
    }, delay);
  }, []);

  const retryPlayback = useCallback(async () => {
    if (manualStopRef.current || recoveryInFlightRef.current) {
      return;
    }

    const nextAttempt = recoveryAttemptRef.current + 1;

    if (nextAttempt > RECOVERY_RETRY_DELAYS.length) {
      setPlaybackState("error");
      setPlaybackError(t("player.reconnectFailed"));
      return;
    }

    recoveryAttemptRef.current = nextAttempt;
    recoveryInFlightRef.current = true;
    setPlaybackState("buffering");
    setPlaybackError(t("player.reconnecting"));

    const audio = getAudioElement();
    let retryDelay: number | undefined;
    let recoveryFailed = false;

    audio.pause();
    if (audio.src !== activeStation.streamUrl) {
      audio.src = activeStation.streamUrl;
    }
    audio.load();

    try {
      await audio.play();
    } catch {
      if (!manualStopRef.current) {
        if (nextAttempt < RECOVERY_RETRY_DELAYS.length) {
          retryDelay = RECOVERY_RETRY_DELAYS[nextAttempt];
        } else {
          recoveryFailed = true;
          setPlaybackState("error");
          setPlaybackError(t("player.reconnectFailed"));
        }
      }
    } finally {
      recoveryInFlightRef.current = false;

      if (!manualStopRef.current && !recoveryFailed && recoveryAttemptRef.current === nextAttempt) {
        queueRecovery(retryDelay ?? RECOVERY_WATCHDOG_DELAY);
      } else if (manualStopRef.current) {
        clearRecoveryTimers();
      }
    }
  }, [activeStation.streamUrl, clearRecoveryTimers, getAudioElement, queueRecovery, t]);

  useEffect(() => {
    retryPlaybackRef.current = retryPlayback;

    return () => {
      retryPlaybackRef.current = undefined;
    };
  }, [retryPlayback]);

  const reconnectPlayback = useCallback(async () => {
    clearRecoveryTimers();
    recoveryAttemptRef.current = 0;
    recoveryInFlightRef.current = false;
    manualStopRef.current = false;
    await retryPlayback();
  }, [clearRecoveryTimers, retryPlayback]);

  const refreshNowPlaying = useCallback(async (stationIds: StationId[] = STATIONS.map((station) => station.id)) => {
    setNowPlaying((current) => markNowPlayingLoading(current, stationIds));

    await Promise.all(
      stationIds.map(async (stationId) => {
        try {
          const response = await fetch(`/api/nowplaying/${stationId}`, { cache: "no-store" });

          if (!response.ok) {
            throw new Error(t("common.unavailable"));
          }

          const payload = (await response.json()) as StationNowPlaying;
          setNowPlaying((current) => ({
            ...current,
            [stationId]: {
              ...payload,
              isLoading: false
            }
          }));
        } catch {
          setNowPlaying((current) => ({
            ...current,
            [stationId]: {
              ...current[stationId],
              isLoading: false,
              error: t("common.unavailable")
            }
          }));
        }
      })
    );
  }, [t]);

  const refreshSchedules = useCallback(async (stationIds: StationId[] = STATIONS.map((station) => station.id)) => {
    setSchedules((current) => markScheduleLoading(current, stationIds));

    await Promise.all(
      stationIds.map(async (stationId) => {
        try {
          const response = await fetch(`/api/schedule/${stationId}`, { cache: "no-store" });

          if (!response.ok) {
            throw new Error(t("schedule.error"));
          }

          const payload = (await response.json()) as StationScheduleDay;
          setSchedules((current) => ({
            ...current,
            [stationId]: {
              ...payload,
              isLoading: false
            }
          }));
        } catch {
          setSchedules((current) => ({
            ...current,
            [stationId]: {
              ...current[stationId],
              isLoading: false,
              error: t("schedule.error")
            }
          }));
        }
      })
    );
  }, [t]);

  const stopPlayback = useCallback(() => {
    manualStopRef.current = true;
    clearRecoveryTimers();
    recoveryAttemptRef.current = 0;
    recoveryInFlightRef.current = false;
    const audio = getAudioElement();

    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    setPlaybackState("idle");
    setPlaybackError(undefined);
    clearMediaSessionPlaybackState();
  }, [clearRecoveryTimers, getAudioElement]);

  const playStation = useCallback(
    async (station: Station) => {
      const audio = getAudioElement();

      manualStopRef.current = false;
      clearRecoveryTimers();
      recoveryAttemptRef.current = 0;
      recoveryInFlightRef.current = false;
      setActiveStationId(station.id);
      setPlaybackState("buffering");
      setPlaybackError(undefined);

      if (typeof window !== "undefined") {
        window.localStorage.setItem("neuralcast:last-station", station.id);
      }

      if (audio.src !== station.streamUrl) {
        audio.pause();
        audio.src = station.streamUrl;
        audio.load();
      }

      try {
        await audio.play();
      } catch {
        setPlaybackState("error");
        setPlaybackError(t("player.playbackBlocked"));
      }

      void refreshNowPlaying([station.id]);
    },
    [clearRecoveryTimers, getAudioElement, refreshNowPlaying, t]
  );

  // Initialize station and audio element listeners
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const lastStation = window.localStorage.getItem("neuralcast:last-station");
    if (lastStation && isStationId(lastStation)) {
      setActiveStationId(lastStation);
    }

    const audio = getAudioElement();
    const storedVolume = readStoredVolume(window.localStorage.getItem(VOLUME_STORAGE_KEY));
    const storedAudibleVolume = readStoredVolume(window.localStorage.getItem(LAST_AUDIBLE_VOLUME_STORAGE_KEY));
    const initialVolume = storedVolume ?? DEFAULT_VOLUME;

    if (storedAudibleVolume !== undefined && storedAudibleVolume > 0) {
      lastAudibleVolumeRef.current = storedAudibleVolume;
    } else if (initialVolume > 0) {
      lastAudibleVolumeRef.current = initialVolume;
    }
    audio.volume = initialVolume;
    setVolumeState(initialVolume);

    if (!audio.paused && audio.src) {
      setPlaybackState("playing");
    }

    const handleLoadStart = () => {
      if (!manualStopRef.current) {
        setPlaybackState("buffering");
      }
    };
    const handleWaiting = () => {
      if (!manualStopRef.current) {
        setPlaybackState("buffering");

        if (stallTimerRef.current === undefined) {
          stallTimerRef.current = window.setTimeout(() => {
            stallTimerRef.current = undefined;
            queueRecovery(0, true);
          }, STALL_RECOVERY_DELAY);
        }
      }
    };
    const handlePlaying = () => {
      clearRecoveryTimers();
      recoveryAttemptRef.current = 0;
      recoveryInFlightRef.current = false;
      setPlaybackState("playing");
      setPlaybackError(undefined);
    };
    const handlePause = () => {
      if (!manualStopRef.current && audio.src && !recoveryInFlightRef.current) {
        setPlaybackState("paused");
      }
    };
    const handleError = () => {
      if (!manualStopRef.current) {
        setPlaybackState("buffering");
        setPlaybackError(t("player.reconnecting"));
        queueRecovery(RECOVERY_RETRY_DELAYS[recoveryAttemptRef.current] ?? RECOVERY_RETRY_DELAYS[0]);
      }
    };

    audio.addEventListener("loadstart", handleLoadStart);
    audio.addEventListener("waiting", handleWaiting);
    audio.addEventListener("stalled", handleWaiting);
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("loadstart", handleLoadStart);
      audio.removeEventListener("waiting", handleWaiting);
      audio.removeEventListener("stalled", handleWaiting);
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("error", handleError);
    };
  }, [clearRecoveryTimers, getAudioElement, queueRecovery, t]);

  // Handle Polling Intervals & Visibility Changes
  useEffect(() => {
    const isHomeRoute = pathname === "/";
    const shouldSyncNowPlaying = isHomeRoute || playbackState !== "idle";
    const shouldSyncSchedules = isHomeRoute;

    if (!shouldSyncNowPlaying && !shouldSyncSchedules) {
      return;
    }

    if (shouldSyncNowPlaying) {
      void refreshNowPlaying();
    }

    const loadSchedules = () => {
      void refreshSchedules();
    };
    let idleCallbackId: number | undefined;
    let scheduleTimeoutId: ReturnType<typeof globalThis.setTimeout> | undefined;

    if (shouldSyncSchedules) {
      if ("requestIdleCallback" in window) {
        idleCallbackId = window.requestIdleCallback(loadSchedules, { timeout: 2500 });
      } else {
        scheduleTimeoutId = globalThis.setTimeout(loadSchedules, 1200);
      }
    }

    const metadataInterval = window.setInterval(() => {
      if (shouldSyncNowPlaying && !document.hidden) {
        void refreshNowPlaying();
      }
    }, 25000);
    const scheduleInterval = window.setInterval(() => {
      if (shouldSyncSchedules && !document.hidden) {
        void refreshSchedules();
      }
    }, 300000);
    const handleVisibility = () => {
      if (!document.hidden) {
        if (shouldSyncNowPlaying) {
          void refreshNowPlaying([activeStationId]);
        }
        if (shouldSyncSchedules) {
          void refreshSchedules();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (idleCallbackId !== undefined) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (scheduleTimeoutId !== undefined) {
        globalThis.clearTimeout(scheduleTimeoutId);
      }
      window.clearInterval(metadataInterval);
      window.clearInterval(scheduleInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeStationId, pathname, playbackState, refreshNowPlaying, refreshSchedules]);

  // Refresh shortly after the predicted end of the active track so metadata and history
  // update promptly while retaining the regular polling fallback for incomplete metadata.
  useEffect(() => {
    const shouldSyncNowPlaying = pathname === "/" || playbackState !== "idle";

    if (!shouldSyncNowPlaying) {
      return;
    }

    const playedAt = activeNowPlaying?.playedAt;
    const duration = activeNowPlaying?.duration;

    if (playedAt === undefined || duration === undefined || !Number.isFinite(playedAt) || !Number.isFinite(duration) || duration <= 0) {
      return;
    }

    const expectedEnd = playedAt * 1000 + duration * 1000;
    const now = Date.now() + serverTimeOffset;
    const delay = expectedEnd > now ? expectedEnd - now + 1000 : 10000;
    const refreshTimer = window.setTimeout(() => {
      void refreshNowPlaying([activeStationId]);
    }, Math.max(1000, delay));

    return () => window.clearTimeout(refreshTimer);
  }, [
    activeNowPlaying?.duration,
    activeNowPlaying?.playedAt,
    activeStationId,
    pathname,
    playbackState,
    refreshNowPlaying,
    serverTimeOffset
  ]);

  // Media Session handlers & metadata synchronization
  useEffect(() => {
    registerMediaSessionHandlers({
      onPlay: () => {
        void playStation(activeStation);
      },
      onPause: stopPlayback,
      onStop: stopPlayback
    });
  }, [activeStation, playStation, stopPlayback]);

  useEffect(() => {
    updateMediaSession(activeStation, activeNowPlaying, playbackState);
  }, [activeNowPlaying, activeStation, playbackState]);

  return (
    <AudioPlayerContext.Provider
      value={{
        activeStationId,
        activeStation,
        playbackState,
        playbackError,
        currentTime,
        volume,
        nowPlaying,
        schedules,
        playStation,
        stopPlayback,
        reconnectPlayback,
        setVolume,
        toggleMute,
        refreshNowPlaying,
        refreshSchedules
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
}

function readStoredVolume(value: string | null): number | undefined {
  if (value === null) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1 ? parsed : undefined;
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error("useAudioPlayer must be used within an AudioPlayerProvider");
  }
  return context;
}

// Helper state creators
function createInitialNowPlayingState(): Record<StationId, StationNowPlayingState> {
  return STATIONS.reduce(
    (state, station) => ({
      ...state,
      [station.id]: {
        stationId: station.id,
        isLoading: true
      }
    }),
    {} as Record<StationId, StationNowPlayingState>
  );
}

function createInitialScheduleState(): Record<StationId, StationScheduleState> {
  return STATIONS.reduce(
    (state, station) => ({
      ...state,
      [station.id]: {
        stationId: station.id,
        isLoading: true
      }
    }),
    {} as Record<StationId, StationScheduleState>
  );
}

function markNowPlayingLoading(
  current: Record<StationId, StationNowPlayingState>,
  stationIds: StationId[]
): Record<StationId, StationNowPlayingState> {
  return stationIds.reduce(
    (state, stationId) => ({
      ...state,
      [stationId]: {
        ...state[stationId],
        isLoading: true,
        error: undefined
      }
    }),
    current
  );
}

function markScheduleLoading(
  current: Record<StationId, StationScheduleState>,
  stationIds: StationId[]
): Record<StationId, StationScheduleState> {
  return stationIds.reduce(
    (state, stationId) => ({
      ...state,
      [stationId]: {
        ...state[stationId],
        isLoading: true,
        error: undefined
      }
    }),
    current
  );
}
