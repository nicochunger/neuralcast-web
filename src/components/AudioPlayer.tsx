"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { DEFAULT_STATION_ID, STATIONS } from "@/lib/stations";
import { MiniPlayer } from "@/components/MiniPlayer";
import { SchedulePreview } from "@/components/SchedulePreview";
import { SiteHeader } from "@/components/SiteHeader";
import { SongRequestModal } from "@/components/SongRequestModal";
import { StationCard } from "@/components/StationCard";
import { submitSongRequestAction } from "@/lib/actions";
import type {
  RequestableSong,
  SongRequestState,
  Station,
  StationId
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
  const {
    activeStationId,
    activeStation,
    playbackState,
    playbackError,
    nowPlaying,
    schedules,
    playStation,
    stopPlayback,
    refreshNowPlaying
  } = useAudioPlayer();

  const [scheduleStationId, setScheduleStationId] = useState<StationId>(DEFAULT_STATION_ID);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | undefined>();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [skippingStationId, setSkippingStationId] = useState<StationId | null>(null);
  const [songRequestState, setSongRequestState] = useState<SongRequestState>({
    stationName: "",
    isLoading: false,
    songs: []
  });

  const scheduleStation = useMemo(
    () => STATIONS.find((station) => station.id === scheduleStationId) ?? STATIONS[0],
    [scheduleStationId]
  );
  const songRequestStation = useMemo(
    () => STATIONS.find((station) => station.id === songRequestState.stationId),
    [songRequestState.stationId]
  );

  // Sync the local schedule display selection with the active station ID
  useEffect(() => {
    setScheduleStationId(activeStationId);
  }, [activeStationId]);

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
    if (!songRequestState.stationId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeSongRequests();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [songRequestState.stationId]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);
      return;
    }

    if (process.env.NODE_ENV === "production") {
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
        const payload = await readJsonResponse(response);

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

  const openSongRequests = useCallback(
    async (station: Station) => {
      setSongRequestState({
        stationId: station.id,
        stationName: station.name,
        isLoading: true,
        songs: []
      });

      try {
        const response = await fetch(`/api/requests/${station.id}`, { cache: "no-store" });
        const payload = (await response.json()) as { songs?: RequestableSong[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error || t("request.loadError"));
        }

        setSongRequestState((current) =>
          current.stationId === station.id
            ? {
                ...current,
                isLoading: false,
                songs: payload.songs ?? []
              }
            : current
        );
      } catch (error) {
        setSongRequestState((current) =>
          current.stationId === station.id
            ? {
                ...current,
                isLoading: false,
                songs: [],
                error: error instanceof Error ? error.message : t("request.loadError")
              }
            : current
        );
      }
    },
    [t]
  );

  const submitSongRequest = useCallback(
    async (song: RequestableSong) => {
      const stationId = songRequestState.stationId;

      if (!stationId || songRequestState.submittingRequestId) {
        return;
      }

      setSongRequestState((current) => ({
        ...current,
        submittingRequestId: song.requestId,
        error: undefined
      }));

      try {
        const result = await submitSongRequestAction(stationId, song.requestUrl);

        if (!result.success) {
          throw new Error(result.error || t("request.submitError"));
        }

        setAdminMessage(result.message || t("request.success"));
        closeSongRequests();
      } catch (error) {
        setSongRequestState((current) => ({
          ...current,
          submittingRequestId: undefined,
          error: error instanceof Error ? error.message : t("request.submitError")
        }));
      }
    },
    [songRequestState.stationId, songRequestState.submittingRequestId, t]
  );

  const closeSongRequests = () => {
    setSongRequestState({
      stationName: "",
      isLoading: false,
      songs: []
    });
  };

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
            onRequestSong={openSongRequests}
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

      {songRequestStation ? (
        <SongRequestModal
          station={songRequestStation}
          requestState={songRequestState}
          onRequestSong={submitSongRequest}
          onDismiss={closeSongRequests}
        />
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

async function readJsonResponse(response: Response): Promise<{ message?: string; error?: string }> {
  const body = await response.text();

  try {
    const parsed = JSON.parse(body) as unknown;
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as { message?: string; error?: string };
    }
  } catch {
    // Fall through to the generic HTML/plaintext handling below.
  }

  if (body.includes("<!DOCTYPE") || body.includes("<html")) {
    return {
      error: "Unexpected HTML response while skipping the current track."
    };
  }

  const text = body.trim();
  return text ? { error: text } : { error: "Unable to skip the current track." };
}
