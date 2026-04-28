"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearMediaSessionPlaybackState, registerMediaSessionHandlers, updateMediaSession } from "@/lib/mediaSession";
import { DEFAULT_STATION_ID, STATIONS, isStationId } from "@/lib/stations";
import { MiniPlayer } from "@/components/MiniPlayer";
import { SchedulePreview } from "@/components/SchedulePreview";
import { StationCard } from "@/components/StationCard";
import type {
  PlaybackState,
  Station,
  StationId,
  StationNowPlaying,
  StationNowPlayingState,
  StationScheduleDay,
  StationScheduleState
} from "@/types/radio";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const manualStopRef = useRef(false);
  const [activeStationId, setActiveStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [scheduleStationId, setScheduleStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackError, setPlaybackError] = useState<string | undefined>();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Record<StationId, StationNowPlayingState>>(
    createInitialNowPlayingState
  );
  const [schedules, setSchedules] = useState<Record<StationId, StationScheduleState>>(createInitialScheduleState);

  const activeStation = useMemo(
    () => STATIONS.find((station) => station.id === activeStationId) ?? STATIONS[0],
    [activeStationId]
  );
  const scheduleStation = useMemo(
    () => STATIONS.find((station) => station.id === scheduleStationId) ?? STATIONS[0],
    [scheduleStationId]
  );

  const refreshNowPlaying = useCallback(async (stationIds: StationId[] = STATIONS.map((station) => station.id)) => {
    setNowPlaying((current) => markNowPlayingLoading(current, stationIds));

    await Promise.all(
      stationIds.map(async (stationId) => {
        try {
          const response = await fetch(`/api/nowplaying/${stationId}`, { cache: "no-store" });

          if (!response.ok) {
            throw new Error("Metadata unavailable.");
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
              error: "Metadata unavailable."
            }
          }));
        }
      })
    );
  }, []);

  const refreshSchedules = useCallback(async (stationIds: StationId[] = STATIONS.map((station) => station.id)) => {
    setSchedules((current) => markScheduleLoading(current, stationIds));

    await Promise.all(
      stationIds.map(async (stationId) => {
        try {
          const response = await fetch(`/api/schedule/${stationId}`, { cache: "no-store" });

          if (!response.ok) {
            throw new Error("Schedule unavailable.");
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
              error: "Schedule unavailable."
            }
          }));
        }
      })
    );
  }, []);

  const stopPlayback = useCallback(() => {
    manualStopRef.current = true;
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    setPlaybackState("idle");
    setPlaybackError(undefined);
    clearMediaSessionPlaybackState();
  }, []);

  const playStation = useCallback(
    async (station: Station) => {
      const audio = audioRef.current;

      if (!audio) {
        return;
      }

      manualStopRef.current = false;
      setActiveStationId(station.id);
      setScheduleStationId(station.id);
      setPlaybackState("buffering");
      setPlaybackError(undefined);
      window.localStorage.setItem("neuralcast:last-station", station.id);

      if (audio.src !== station.streamUrl) {
        audio.pause();
        audio.src = station.streamUrl;
        audio.load();
      }

      try {
        await audio.play();
      } catch {
        setPlaybackState("error");
        setPlaybackError("Playback was blocked or the stream could not be reached. Tap Play again after checking the network.");
      }

      void refreshNowPlaying([station.id]);
    },
    [refreshNowPlaying]
  );

  useEffect(() => {
    const lastStation = window.localStorage.getItem("neuralcast:last-station");

    if (lastStation && isStationId(lastStation)) {
      setActiveStationId(lastStation);
      setScheduleStationId(lastStation);
    }
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
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
        setPlaybackError("The stream could not be loaded.");
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
  }, []);

  useEffect(() => {
    void refreshNowPlaying();
    void refreshSchedules();

    const metadataInterval = window.setInterval(() => {
      if (!document.hidden) {
        void refreshNowPlaying();
      }
    }, 25000);
    const scheduleInterval = window.setInterval(() => {
      if (!document.hidden) {
        void refreshSchedules();
      }
    }, 300000);
    const handleVisibility = () => {
      if (!document.hidden) {
        void refreshNowPlaying([activeStationId]);
        void refreshSchedules();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.clearInterval(metadataInterval);
      window.clearInterval(scheduleInterval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [activeStationId, refreshNowPlaying, refreshSchedules]);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

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

  const requestInstall = async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  return (
    <main className="appShell">
      <audio ref={audioRef} preload="none" />

      <header className="appHeader">
        <div className="brandLockup">
          <img src="/neuralcast-logo.png" alt="" className="brandIcon" />
          <div>
            <h1>NeuralCast</h1>
            <p>Live AI radio from Estavayer, Switzerland.</p>
          </div>
        </div>
        <div className="headerActions">
          {installPrompt ? (
            <button className="installButton" type="button" onClick={requestInstall}>
              Install
            </button>
          ) : null}
        </div>
      </header>

      <section className="stationGrid" aria-label="Stations">
        {STATIONS.map((station) => (
          <StationCard
            key={station.id}
            station={station}
            isActive={station.id === activeStationId}
            playbackState={playbackState}
            nowPlaying={nowPlaying[station.id]}
            schedule={schedules[station.id]}
            isScheduleSelected={station.id === scheduleStationId}
            onPlay={playStation}
            onStop={stopPlayback}
            onSelectSchedule={(selectedStation) => setScheduleStationId(selectedStation.id)}
          />
        ))}
      </section>

      {playbackError ? <p className="playerError">{playbackError}</p> : null}

      <SchedulePreview station={scheduleStation} schedule={schedules[scheduleStation.id]} />

      <footer className="appFooter">
        <span>Live streams require a network connection.</span>
        <span>Add to Home Screen on iOS from the Share menu.</span>
      </footer>

      <MiniPlayer
        station={activeStation}
        playbackState={playbackState}
        nowPlaying={nowPlaying[activeStation.id]}
        onPlay={playStation}
        onStop={stopPlayback}
      />
    </main>
  );
}

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
