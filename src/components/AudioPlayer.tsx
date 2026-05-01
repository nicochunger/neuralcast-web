"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
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

type ResolvedTheme = "light" | "dark";
type ThemePreference = "system" | ResolvedTheme;

const THEME_STORAGE_KEY = "neuralcast:theme";

export function AudioPlayer() {
  const { locale, setLocale, t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const manualStopRef = useRef(false);
  const [activeStationId, setActiveStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [scheduleStationId, setScheduleStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [playbackError, setPlaybackError] = useState<string | undefined>();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
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
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialPreference: ThemePreference = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";

    const updateResolvedTheme = (preference: ThemePreference) => {
      setResolvedTheme(preference === "system" ? (mediaQuery.matches ? "dark" : "light") : preference);
    };

    setThemePreference(initialPreference);
    applyThemePreference(initialPreference);
    updateResolvedTheme(initialPreference);

    const handleSystemThemeChange = () => {
      if (!document.documentElement.dataset.theme) {
        updateResolvedTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
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

  const toggleTheme = () => {
    const nextTheme: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemePreference(nextTheme);
    setResolvedTheme(nextTheme);
    applyThemePreference(nextTheme);
  };

  return (
    <main className="appShell">
      <audio ref={audioRef} preload="none" />

      <header className="appHeader">
        <div className="brandLockup">
          <img src="/neuralcast-logo.png" alt="" className="brandIcon" />
          <div>
            <h1>NeuralCast</h1>
            <p>{t("app.tagline")}</p>
          </div>
        </div>
        <div className="headerActions">
          <div className="languageToggle" role="group" aria-label={t("common.language")}>
            <button
              className={`languageButton ${locale === "en" ? "languageButtonActive" : ""}`}
              type="button"
              onClick={() => setLocale("en")}
              aria-pressed={locale === "en"}
              title="English"
            >
              <FlagIcon country="us" />
              <span>EN</span>
            </button>
            <button
              className={`languageButton ${locale === "es" ? "languageButtonActive" : ""}`}
              type="button"
              onClick={() => setLocale("es")}
              aria-pressed={locale === "es"}
              title="Español"
            >
              <FlagIcon country="ar" />
              <span>ES</span>
            </button>
          </div>
          {installPrompt ? (
            <button className="installButton" type="button" onClick={requestInstall}>
              {t("common.install")}
            </button>
          ) : null}
          <button
            className={`themeButton themeButton${resolvedTheme === "dark" ? "Dark" : "Light"}`}
            type="button"
            onClick={toggleTheme}
            aria-label={resolvedTheme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
            title={t("theme.title", {
              theme:
                themePreference === "system"
                  ? `${t("theme.system")} (${t(`theme.${resolvedTheme}`)})`
                  : t(`theme.${resolvedTheme}`),
              action: resolvedTheme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")
            })}
          >
            <span className="themeIcon" aria-hidden="true">
              <span className="themeSun" />
              <span className="themeMoon" />
            </span>
          </button>
        </div>
      </header>

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
            onSelectSchedule={(selectedStation) => setScheduleStationId(selectedStation.id)}
          />
        ))}
      </section>

      {playbackError ? <p className="playerError">{playbackError}</p> : null}

      <SchedulePreview station={scheduleStation} schedule={schedules[scheduleStation.id]} />

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

function FlagIcon({ country }: { country: "us" | "ar" }) {
  if (country === "ar") {
    return (
      <svg className="languageFlag" viewBox="0 0 28 20" role="img" aria-label="Argentina flag">
        <rect width="28" height="20" fill="#75aadb" />
        <rect y="6.67" width="28" height="6.66" fill="#ffffff" />
        <circle cx="14" cy="10" r="2.1" fill="#f6b40e" />
        <circle cx="14" cy="10" r="1.1" fill="#d98f00" />
      </svg>
    );
  }

  return (
    <svg className="languageFlag" viewBox="0 0 28 20" role="img" aria-label="United States flag">
      <rect width="28" height="20" fill="#b22234" />
      {Array.from({ length: 6 }, (_, index) => (
        <rect key={index} y={1.54 + index * 3.08} width="28" height="1.54" fill="#ffffff" />
      ))}
      <rect width="11.8" height="10.77" fill="#3c3b6e" />
      {Array.from({ length: 12 }, (_, index) => (
        <circle
          key={index}
          cx={2 + (index % 4) * 2.5}
          cy={2 + Math.floor(index / 4) * 2.5}
          r="0.38"
          fill="#ffffff"
        />
      ))}
    </svg>
  );
}

function applyThemePreference(preference: ThemePreference) {
  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = preference;
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
