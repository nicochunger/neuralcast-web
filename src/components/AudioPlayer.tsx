"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { clearMediaSessionPlaybackState, registerMediaSessionHandlers, updateMediaSession } from "@/lib/mediaSession";
import {
  getPersistentAudioElement,
  getPersistentPlayerState,
  setPersistentPlayerState
} from "@/lib/persistentPlayer";
import { DEFAULT_STATION_ID, STATIONS, isStationId } from "@/lib/stations";
import { MiniPlayer } from "@/components/MiniPlayer";
import { SchedulePreview } from "@/components/SchedulePreview";
import { SiteHeader } from "@/components/SiteHeader";
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

interface AudioPlayerProps {
  isAdmin: boolean;
}

export function AudioPlayer({ isAdmin }: AudioPlayerProps) {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const manualStopRef = useRef(false);
  const [activeStationId, setActiveStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [scheduleStationId, setScheduleStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackError, setPlaybackError] = useState<string | undefined>();
  const [adminMessage, setAdminMessage] = useState<string | undefined>();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [skippingStationId, setSkippingStationId] = useState<StationId | null>(null);
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
  }, []);

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
    setPersistentPlayerState({
      activeStationId,
      playbackState: "idle"
    });
  }, [activeStationId]);

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
        setPlaybackError(t("player.playbackBlocked"));
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
    const persistedState = getPersistentPlayerState();
    const audio = getPersistentAudioElement();

    if (!persistedState) {
      return;
    }

    setActiveStationId(persistedState.activeStationId);
    setScheduleStationId(persistedState.activeStationId);

    if (!audio.paused && audio.src) {
      setPlaybackState("playing");
      setPlaybackError(undefined);
    } else {
      setPlaybackState(persistedState.playbackState);
    }

    void refreshNowPlaying([persistedState.activeStationId]);
  }, [refreshNowPlaying]);

  useEffect(() => {
    if (!isScheduleOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsScheduleOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isScheduleOpen]);

  useEffect(() => {
    audioRef.current = getPersistentAudioElement();
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
  }, [t]);

  useEffect(() => {
    setPersistentPlayerState({
      activeStationId,
      playbackState,
      trackText: nowPlaying[activeStationId]?.text
    });
  }, [activeStationId, nowPlaying, playbackState]);

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
    if (
      "serviceWorker" in navigator &&
      (process.env.NODE_ENV === "production" || window.location.hostname === "localhost")
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    setIsAndroid(/android/i.test(window.navigator.userAgent));
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
      window.alert(t("player.installFallbackAndroid"));
      return;
    }

    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

  const skipTrack = useCallback(
    async (station: Station) => {
      if (!isAdmin || skippingStationId) {
        return;
      }

      setAdminMessage(undefined);
      setSkippingStationId(station.id);

      try {
        const response = await fetch(`/api/admin/skip/${station.id}`, {
          method: "POST",
          cache: "no-store"
        });
        const payload = (await response.json()) as { message?: string; error?: string };

        if (!response.ok) {
          throw new Error(payload.error || "Unable to skip the current track.");
        }

        setAdminMessage(payload.message || `Skipped current track on ${station.name}.`);
        window.setTimeout(() => {
          void refreshNowPlaying([station.id]);
        }, 1200);
      } catch (error) {
        setAdminMessage(error instanceof Error ? error.message : "Unable to skip the current track.");
      } finally {
        setSkippingStationId(null);
      }
    },
    [isAdmin, refreshNowPlaying, skippingStationId]
  );

  return (
    <main className="appShell">
      <SiteHeader
        extraActions={
          (installPrompt || (isAndroid && !isStandalone)) ? (
            <button className="installButton" type="button" onClick={requestInstall}>
              {t("common.install")}
            </button>
          ) : null
        }
      />

      <section className="stationGrid" aria-label={t("stations.ariaLabel")}>
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
            onSelectSchedule={(selectedStation) => {
              setScheduleStationId(selectedStation.id);
              setIsScheduleOpen(true);
            }}
            showAdminSkip={isAdmin}
            isSkippingTrack={skippingStationId === station.id}
            onSkipTrack={skipTrack}
          />
        ))}
      </section>

      {playbackError ? <p className="playerError">{playbackError}</p> : null}
      {adminMessage ? <p className="playerError">{adminMessage}</p> : null}

      {isScheduleOpen ? (
        <div
          className="scheduleModalBackdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsScheduleOpen(false);
            }
          }}
        >
          <div className="scheduleModal" role="dialog" aria-modal="true" aria-labelledby="schedule-title">
            <button
              className="scheduleModalClose"
              type="button"
              onClick={() => setIsScheduleOpen(false)}
              aria-label="Close schedule"
            >
              ✕
            </button>
            <SchedulePreview station={scheduleStation} schedule={schedules[scheduleStation.id]} />
          </div>
        </div>
      ) : null}

      <footer className="appFooter">
        <span>{t("footer.connection")}</span>
        <span>{t("footer.iosInstall")}</span>
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
