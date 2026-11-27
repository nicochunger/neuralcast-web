"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SonicAtlasConstellation } from "@/components/SonicAtlasConstellation";
import { SonicAtlasInspector } from "@/components/SonicAtlasInspector";
import { SonicAtlasTimeline } from "@/components/SonicAtlasTimeline";
import { SonicAtlasVault } from "@/components/SonicAtlasVault";
import { useI18n } from "@/lib/i18n";
import { STATIONS } from "@/lib/stations";
import type {
  AtlasErrorCode,
  PlaylistDetailPayload,
  StationAtlasPayload,
} from "@/types/atlas";
import type { ScheduleSegment, StationId, StationScheduleDay } from "@/types/radio";
import styles from "./SonicAtlas.module.css";

interface SonicAtlasPageProps {
  initialStation: StationId;
  initialAtlas: StationAtlasPayload | null;
  initialErrorCode: AtlasErrorCode | null;
}

function formatEraSpan(minYear: number | null, maxYear: number | null): string {
  if (minYear && maxYear) {
    return minYear === maxYear ? String(minYear) : `${minYear}–${maxYear}`;
  }
  if (minYear) return `${minYear}–`;
  if (maxYear) return `–${maxYear}`;
  return "—";
}

export function SonicAtlasPage({
  initialStation,
  initialAtlas,
  initialErrorCode,
}: SonicAtlasPageProps) {
  const router = useRouter();
  const { t, locale } = useI18n();

  const [activeStation, setActiveStation] = useState<StationId>(initialStation);
  const [atlas, setAtlas] = useState<StationAtlasPayload | null>(initialAtlas);
  const [errorCode, setErrorCode] = useState<AtlasErrorCode | null>(initialErrorCode);
  const [isLoadingAtlas, setIsLoadingAtlas] = useState(false);

  const [selectedDecades, setSelectedDecades] = useState<number[]>([]);
  const [selectedPlaylistSlug, setSelectedPlaylistSlug] = useState<string | null>(null);
  const [selectedArtistSlug, setSelectedArtistSlug] = useState<string | null>(null);

  const [playlistDetail, setPlaylistDetail] = useState<PlaylistDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const [scheduleSegments, setScheduleSegments] = useState<ScheduleSegment[]>([]);

  const atlasCacheRef = useRef<Map<StationId, StationAtlasPayload>>(new Map());
  const detailCacheRef = useRef<Map<string, PlaylistDetailPayload>>(new Map());
  const scheduleCacheRef = useRef<Map<StationId, ScheduleSegment[]>>(new Map());
  const activeStationRef = useRef<StationId>(initialStation);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const vaultRef = useRef<HTMLDivElement | null>(null);

  if (initialAtlas && !atlasCacheRef.current.has(initialStation)) {
    atlasCacheRef.current.set(initialStation, initialAtlas);
  }

  // Sync if Next.js route searchParams prop updates (e.g. clicking SiteHeader or browser Back/Forward)
  useEffect(() => {
    const stationChangedExternally = initialStation !== activeStationRef.current;
    if (stationChangedExternally) {
      activeStationRef.current = initialStation;
      setActiveStation(initialStation);
      setSelectedDecades([]);
      setSelectedPlaylistSlug(null);
      setSelectedArtistSlug(null);
      setPlaylistDetail(null);
    }

    if (initialAtlas) {
      atlasCacheRef.current.set(initialStation, initialAtlas);
      if (stationChangedExternally || !atlas) {
        setAtlas(initialAtlas);
        setErrorCode(null);
        setIsLoadingAtlas(false);
      }
    } else if (stationChangedExternally) {
      if (atlasCacheRef.current.has(initialStation)) {
        setAtlas(atlasCacheRef.current.get(initialStation)!);
        setErrorCode(null);
        setIsLoadingAtlas(false);
      } else {
        setAtlas(null);
        setErrorCode(initialErrorCode);
      }
    }
  }, [initialStation, initialAtlas, initialErrorCode]);

  const fetchStationAtlas = useCallback(
    async (station: StationId, forceReload = false) => {
      if (!forceReload && atlasCacheRef.current.has(station)) {
        setAtlas(atlasCacheRef.current.get(station)!);
        setErrorCode(null);
        setIsLoadingAtlas(false);
        return;
      }

      setIsLoadingAtlas(true);
      setErrorCode(null);

      try {
        const response = await fetch(`/api/atlas/${station}`, {
          cache: forceReload ? "no-store" : "default",
        });

        if (activeStationRef.current !== station) return;

        if (!response.ok) {
          let code: AtlasErrorCode = "unavailable";
          try {
            const body = (await response.json()) as { code?: string };
            if (body.code === "unconfigured") code = "unconfigured";
          } catch {
            // Keep default unavailable code
          }
          setAtlas(null);
          setErrorCode(code);
          return;
        }

        const payload = (await response.json()) as StationAtlasPayload;
        if (activeStationRef.current !== station) return;

        atlasCacheRef.current.set(station, payload);
        setAtlas(payload);
        setErrorCode(null);
      } catch {
        if (activeStationRef.current !== station) return;
        setAtlas(null);
        setErrorCode("unavailable");
      } finally {
        if (activeStationRef.current === station) {
          setIsLoadingAtlas(false);
        }
      }
    },
    []
  );

  const handleStationSwitch = (nextStation: StationId) => {
    if (nextStation === activeStation && atlas) return;
    activeStationRef.current = nextStation;
    setActiveStation(nextStation);
    setSelectedDecades([]);
    setSelectedPlaylistSlug(null);
    setSelectedArtistSlug(null);
    setPlaylistDetail(null);
    router.push(`/explore?station=${nextStation}`, { scroll: false });
    void fetchStationAtlas(nextStation);
  };

  // Fetch today's schedule once per station (best-effort, degrades silently)
  useEffect(() => {
    let cancelled = false;

    if (scheduleCacheRef.current.has(activeStation)) {
      setScheduleSegments(scheduleCacheRef.current.get(activeStation)!);
      return;
    }

    setScheduleSegments([]);

    (async () => {
      try {
        const res = await fetch(`/api/schedule/${activeStation}`);
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as StationScheduleDay;
        if (cancelled) return;
        const segments = Array.isArray(data.segments) ? data.segments : [];
        scheduleCacheRef.current.set(activeStation, segments);
        setScheduleSegments(segments);
      } catch {
        // Schedule is optional enrichment; degrade gracefully
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeStation]);

  // Fetch playlist detail on demand with client-side caching
  const loadPlaylistDetail = useCallback(
    async (station: StationId, slug: string, forceReload = false) => {
      const cacheKey = `${station}:${slug}`;
      if (!forceReload && detailCacheRef.current.has(cacheKey)) {
        setPlaylistDetail(detailCacheRef.current.get(cacheKey)!);
        setDetailLoading(false);
        setDetailError(false);
        return;
      }

      setDetailLoading(true);
      setDetailError(false);
      setPlaylistDetail(null);

      try {
        const res = await fetch(`/api/atlas/${station}/playlist/${encodeURIComponent(slug)}`, {
          cache: forceReload ? "no-store" : "default",
        });
        if (!res.ok) {
          throw new Error("Playlist detail unavailable");
        }
        const payload = (await res.json()) as PlaylistDetailPayload;
        detailCacheRef.current.set(cacheKey, payload);
        if (activeStationRef.current === station) {
          setPlaylistDetail(payload);
          setDetailError(false);
        }
      } catch {
        if (activeStationRef.current === station) {
          setDetailError(true);
        }
      } finally {
        if (activeStationRef.current === station) {
          setDetailLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!selectedPlaylistSlug) {
      setPlaylistDetail(null);
      setDetailLoading(false);
      setDetailError(false);
      return;
    }
    void loadPlaylistDetail(activeStation, selectedPlaylistSlug);
  }, [activeStation, loadPlaylistDetail, selectedPlaylistSlug]);

  const stationMeta = useMemo(
    () => STATIONS.find((s) => s.id === activeStation) ?? STATIONS[0],
    [activeStation]
  );

  const selectedPlaylist = useMemo(() => {
    if (!atlas || !selectedPlaylistSlug) return null;
    return atlas.playlists.find((pl) => pl.slug === selectedPlaylistSlug) ?? null;
  }, [atlas, selectedPlaylistSlug]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  const handleToggleDecade = (decade: number) => {
    setSelectedDecades((prev) =>
      prev.includes(decade) ? prev.filter((item) => item !== decade) : [...prev, decade]
    );
  };

  const handleSelectPlaylistFromVault = (slug: string) => {
    setSelectedPlaylistSlug(slug);
    workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSelectArtistFromInspector = (artistSlug: string) => {
    setSelectedArtistSlug(artistSlug);
    vaultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const stationClass =
    activeStation === "neuralforge" ? styles.stationNeuralforge : styles.stationNeuralcast;

  return (
    <div className="appShell">
      <SiteHeader exploreStation={activeStation} />
      <main className={`${styles.page} ${stationClass}`}>
        {/* Hero Header + Station Switcher + Stat Strip */}
        <section className={styles.hero} aria-labelledby="atlas-page-heading">
          <div className={styles.heroTop}>
            <div className={styles.heroIntro}>
              <h1 id="atlas-page-heading">{t("atlas.title")}</h1>
              <p>{t("atlas.subtitle")}</p>
            </div>

            <nav
              className={styles.stationSwitcher}
              aria-label={t("atlas.stationSwitcherAria")}
            >
              {STATIONS.map((item) => {
                const isActive = item.id === activeStation;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.stationTab} ${isActive ? styles.stationTabActive : ""}`}
                    aria-pressed={isActive}
                    aria-label={t("atlas.switchToStation", { station: item.name })}
                    onClick={() => handleStationSwitch(item.id)}
                  >
                    <img
                      src={item.artworkImage}
                      alt=""
                      width={28}
                      height={28}
                      className={styles.stationTabThumb}
                    />
                    <span>{item.name}</span>
                    <span
                      className={`${styles.stationDot} ${
                        item.id === "neuralforge"
                          ? styles.stationDotNeuralforge
                          : styles.stationDotNeuralcast
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </nav>
          </div>

          {isLoadingAtlas ? (
            <div className={styles.loadingBar} role="status" aria-live="polite">
              <span className={styles.loadingDot} aria-hidden="true" />
              <span>{t("atlas.loading")}</span>
            </div>
          ) : null}

          {atlas ? (
            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {numberFormatter.format(atlas.stats.unique_tracks)}
                </span>
                <span className={styles.statLabel}>{t("atlas.stats.tracks")}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {numberFormatter.format(atlas.stats.unique_artists)}
                </span>
                <span className={styles.statLabel}>{t("atlas.stats.artists")}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {numberFormatter.format(atlas.stats.playlist_count)}
                </span>
                <span className={styles.statLabel}>{t("atlas.stats.playlists")}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {formatEraSpan(atlas.stats.min_year, atlas.stats.max_year)}
                </span>
                <span className={styles.statLabel}>{t("atlas.stats.eraSpan")}</span>
              </div>
              <div className={styles.statCard}>
                <span className={styles.statValue}>
                  {numberFormatter.format(atlas.stats.bridge_count)}
                </span>
                <span className={styles.statLabel}>{t("atlas.stats.bridges")}</span>
              </div>
              {atlas.stats.episode_count > 0 ? (
                <div className={styles.statCard}>
                  <span className={styles.statValue}>
                    {numberFormatter.format(atlas.stats.episode_count)}
                  </span>
                  <span className={styles.statLabel}>{t("atlas.stats.episodes")}</span>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Degraded / Error State */}
        {!atlas && !isLoadingAtlas ? (
          <section className={styles.statusBanner} role="alert">
            <div className={styles.statusBannerCopy}>
              <h2>{t("atlas.errorTitle")}</h2>
              <p>
                {errorCode === "unconfigured"
                  ? t("atlas.errorUnconfigured")
                  : t("atlas.errorUnavailable")}
              </p>
            </div>
            <div className={styles.toolbarControls}>
              <button
                type="button"
                className={styles.retryButton}
                onClick={() => void fetchStationAtlas(activeStation, true)}
              >
                {t("atlas.retry")}
              </button>
              <Link href="/" className={styles.backButton}>
                {t("atlas.listenLive")} →
              </Link>
            </div>
          </section>
        ) : null}

        {/* Coordinated Atlas Views */}
        {atlas ? (
          <>
            <div
              ref={workspaceRef}
              className={`${styles.atlasWorkspace} ${
                selectedPlaylist ? styles.atlasWorkspaceWithInspector : ""
              }`}
            >
              <SonicAtlasConstellation
                stationId={activeStation}
                stationName={atlas.station_name}
                playlists={atlas.playlists}
                bridges={atlas.bridges}
                selectedSlug={selectedPlaylistSlug}
                selectedDecades={selectedDecades}
                onSelectPlaylist={setSelectedPlaylistSlug}
              />

              {selectedPlaylist ? (
                <SonicAtlasInspector
                  station={activeStation}
                  stationTimeZone={stationMeta.timeZone}
                  playlist={selectedPlaylist}
                  allPlaylists={atlas.playlists}
                  bridges={atlas.bridges}
                  episodes={atlas.episodes}
                  scheduleSegments={scheduleSegments}
                  detail={
                    playlistDetail && playlistDetail.playlist.slug === selectedPlaylist.slug
                      ? playlistDetail
                      : null
                  }
                  detailLoading={detailLoading}
                  detailError={detailError}
                  onRetryDetail={() =>
                    void loadPlaylistDetail(activeStation, selectedPlaylist.slug, true)
                  }
                  onClose={() => setSelectedPlaylistSlug(null)}
                  onSelectPlaylist={setSelectedPlaylistSlug}
                  onSelectArtist={handleSelectArtistFromInspector}
                />
              ) : null}
            </div>

            <SonicAtlasTimeline
              decades={atlas.decades}
              selectedDecades={selectedDecades}
              onToggleDecade={handleToggleDecade}
              onClearDecades={() => setSelectedDecades([])}
              onSelectPlaylist={handleSelectPlaylistFromVault}
            />

            <div ref={vaultRef}>
              <SonicAtlasVault
                station={activeStation}
                artists={atlas.artists}
                playlists={atlas.playlists}
                episodes={atlas.episodes}
                selectedDecades={selectedDecades}
                selectedArtistSlug={selectedArtistSlug}
                onSelectArtist={setSelectedArtistSlug}
                onSelectPlaylist={handleSelectPlaylistFromVault}
              />
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
