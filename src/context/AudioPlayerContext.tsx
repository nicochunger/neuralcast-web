"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import { clearMediaSessionPlaybackState, registerMediaSessionHandlers, updateMediaSession } from "@/lib/mediaSession";
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
  nowPlaying: Record<StationId, StationNowPlayingState>;
  schedules: Record<StationId, StationScheduleState>;
  playStation: (station: Station) => Promise<void>;
  stopPlayback: () => void;
  refreshNowPlaying: (stationIds?: StationId[]) => Promise<void>;
  refreshSchedules: (stationIds?: StationId[]) => Promise<void>;
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | undefined>(undefined);
let sharedAudioElement: HTMLAudioElement | null = null;

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const manualStopRef = useRef(false);

  const [activeStationId, setActiveStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackError, setPlaybackError] = useState<string | undefined>();

  const [nowPlaying, setNowPlaying] = useState<Record<StationId, StationNowPlayingState>>(
    createInitialNowPlayingState
  );
  const [schedules, setSchedules] = useState<Record<StationId, StationScheduleState>>(
    createInitialScheduleState
  );

  const activeStation = useMemo(
    () => STATIONS.find((station) => station.id === activeStationId) ?? STATIONS[0],
    [activeStationId]
  );

  const getAudioElement = useCallback(() => {
    if (!sharedAudioElement) {
      sharedAudioElement = new Audio();
      sharedAudioElement.preload = "none";
    }

    audioRef.current = sharedAudioElement;
    return audioRef.current;
  }, []);

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
    const audio = getAudioElement();

    audio.pause();
    audio.removeAttribute("src");
    audio.load();

    setPlaybackState("idle");
    setPlaybackError(undefined);
    clearMediaSessionPlaybackState();
  }, [getAudioElement]);

  const playStation = useCallback(
    async (station: Station) => {
      const audio = getAudioElement();

      manualStopRef.current = false;
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
    [refreshNowPlaying, t]
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
      }
    };
    const handlePlaying = () => setPlaybackState("playing");
    const handlePause = () => {
      if (!manualStopRef.current && audio.src) {
        setPlaybackState("paused");
      }
    };
    const handleError = () => {
      if (!manualStopRef.current) {
        setPlaybackState("error");
        setPlaybackError(t("player.streamLoadError"));
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
  }, [getAudioElement, t]);

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
    updateMediaSession(activeStation, nowPlaying[activeStation.id], playbackState === "playing");
  }, [activeStation, nowPlaying, playbackState]);

  return (
    <AudioPlayerContext.Provider
      value={{
        activeStationId,
        activeStation,
        playbackState,
        playbackError,
        nowPlaying,
        schedules,
        playStation,
        stopPlayback,
        refreshNowPlaying,
        refreshSchedules
      }}
    >
      {children}
    </AudioPlayerContext.Provider>
  );
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
