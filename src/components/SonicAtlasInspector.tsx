"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CloseIcon } from "@/components/CloseIcon";
import { formatEpisodeNumber } from "@/lib/episodes";
import { getSegmentTitle, useI18n } from "@/lib/i18n";
import { formatTrackTime } from "@/lib/trackProgress";
import type {
  AtlasBridge,
  AtlasEpisodeRef,
  AtlasPlaylistNode,
  PlaylistDetailPayload,
  RotationRole,
} from "@/types/atlas";
import type { ScheduleSegment, StationId } from "@/types/radio";
import styles from "./SonicAtlas.module.css";

interface SonicAtlasInspectorProps {
  station: StationId;
  stationTimeZone: string;
  playlist: AtlasPlaylistNode;
  allPlaylists: AtlasPlaylistNode[];
  bridges: AtlasBridge[];
  episodes: AtlasEpisodeRef[];
  scheduleSegments: ScheduleSegment[];
  detail: PlaylistDetailPayload | null;
  detailLoading: boolean;
  detailError: boolean;
  onRetryDetail: () => void;
  onClose: () => void;
  onSelectPlaylist: (slug: string) => void;
  onSelectArtist: (artistSlug: string) => void;
}

type TrackSortField = "artist" | "title" | "year";

function roleBadgeClass(role: RotationRole): string {
  if (role === "open_only") return styles.roleOpen;
  if (role === "reserved_window") return styles.roleReserved;
  return styles.roleThemed;
}

function formatYearRange(minYear: number | null, maxYear: number | null): string {
  if (minYear && maxYear) {
    return minYear === maxYear ? String(minYear) : `${minYear}–${maxYear}`;
  }
  if (minYear) return `${minYear}–`;
  if (maxYear) return `–${maxYear}`;
  return "—";
}

function formatBlockTime(segment: ScheduleSegment, timeZone: string, locale: string): string {
  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    return `${formatter.format(new Date(segment.startTime))}–${formatter.format(new Date(segment.endTime))}`;
  } catch {
    return `${segment.startTime.slice(11, 16)}–${segment.endTime.slice(11, 16)}`;
  }
}

export function SonicAtlasInspector({
  station,
  stationTimeZone,
  playlist,
  allPlaylists,
  bridges,
  episodes,
  scheduleSegments,
  detail,
  detailLoading,
  detailError,
  onRetryDetail,
  onClose,
  onSelectPlaylist,
  onSelectArtist,
}: SonicAtlasInspectorProps) {
  const { t, locale } = useI18n();
  const [trackQuery, setTrackQuery] = useState("");
  const [sortField, setSortField] = useState<TrackSortField>("artist");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [viewerTimeZone, setViewerTimeZone] = useState(stationTimeZone);

  useEffect(() => {
    try {
      setViewerTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || stationTimeZone);
    } catch {
      setViewerTimeZone(stationTimeZone);
    }
  }, [stationTimeZone]);

  useEffect(() => {
    setTrackQuery("");
  }, [playlist.slug, station]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const playlistNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const pl of allPlaylists) {
      map.set(pl.slug, pl.name);
    }
    return map;
  }, [allPlaylists]);

  const playlistDecades = useMemo(() => {
    if (detail?.decades && detail.decades.length > 0) {
      return detail.decades;
    }
    return Object.entries(playlist.decades)
      .map(([dec, count]) => {
        const num = Number(dec);
        return { decade: num, label: `${num}s`, track_count: count };
      })
      .filter((item) => Number.isFinite(item.decade) && item.track_count > 0)
      .sort((a, b) => a.decade - b.decade);
  }, [detail?.decades, playlist.decades]);

  const maxMiniDecade = useMemo(
    () => Math.max(1, ...playlistDecades.map((d) => d.track_count)),
    [playlistDecades]
  );

  const connectedPlaylists = useMemo(() => {
    if (detail?.bridges) {
      return detail.bridges;
    }
    return bridges
      .filter((b) => b.source === playlist.slug || b.target === playlist.slug)
      .map((b) => {
        const otherSlug = b.source === playlist.slug ? b.target : b.source;
        return {
          playlist_slug: otherSlug,
          playlist_name: playlistNameBySlug.get(otherSlug) ?? otherSlug,
          shared_count: b.shared_count,
          jaccard: b.jaccard,
          sample_tracks: b.sample_tracks,
        };
      })
      .sort((a, b) => b.shared_count - a.shared_count || a.playlist_name.localeCompare(b.playlist_name));
  }, [bridges, detail?.bridges, playlist.slug, playlistNameBySlug]);

  const featuredEpisodes = useMemo(() => {
    if (detail?.episodes && detail.episodes.length > 0) {
      return detail.episodes;
    }
    const idSet = new Set(playlist.episode_ids);
    return episodes.filter((ep) => idSet.has(ep.id));
  }, [detail?.episodes, episodes, playlist.episode_ids]);

  const matchingScheduleBlocks = useMemo(() => {
    const targetName = playlist.name.trim().toLowerCase();
    return scheduleSegments.filter((segment) =>
      segment.playlistNames.some((name) => name.trim().toLowerCase() === targetName)
    );
  }, [playlist.name, scheduleSegments]);

  const filteredTracks = useMemo(() => {
    const tracks = detail?.tracks ?? [];
    const q = trackQuery.trim().toLowerCase();
    const matched = q
      ? tracks.filter(
          (item) =>
            item.artist.toLowerCase().includes(q) ||
            item.title.toLowerCase().includes(q) ||
            item.album.toLowerCase().includes(q) ||
            (item.year !== null && String(item.year).includes(q))
        )
      : tracks;

    const dir = sortDir === "asc" ? 1 : -1;
    return [...matched].sort((a, b) => {
      if (sortField === "title") {
        return a.title.localeCompare(b.title) * dir || a.artist.localeCompare(b.artist);
      }
      if (sortField === "year") {
        const ay = a.year ?? (sortDir === "asc" ? 9999 : -1);
        const by = b.year ?? (sortDir === "asc" ? 9999 : -1);
        return (ay - by) * dir || a.artist.localeCompare(b.artist);
      }
      return a.artist.localeCompare(b.artist) * dir || a.title.localeCompare(b.title);
    });
  }, [detail?.tracks, sortDir, sortField, trackQuery]);

  const handleSortClick = (field: TrackSortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  return (
    <aside
      className={styles.inspectorPanel}
      aria-label={`${t("atlas.inspector.title")} — ${playlist.name}`}
      data-inspector-slug={playlist.slug}
    >
      <div className={styles.inspectorHeader}>
        <div className={styles.inspectorTitleGroup}>
          <span className={`${styles.roleBadge} ${roleBadgeClass(playlist.rotation_role)}`}>
            {t(`atlas.role.${playlist.rotation_role}`)}
          </span>
          <h2>{playlist.name}</h2>
          <div className={styles.inspectorMetaChips}>
            <span className={styles.metaChip}>
              {t("atlas.timeline.tracksLabel", { count: playlist.track_count })}
            </span>
            <span className={styles.metaChip}>
              {playlist.unique_artist_count} {t("atlas.stats.artists").toLowerCase()}
            </span>
            <span className={styles.metaChip}>
              {formatYearRange(playlist.min_year, playlist.max_year)}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.closeButton}
          onClick={onClose}
          aria-label={t("atlas.inspector.close")}
          title={t("atlas.inspector.close")}
        >
          <CloseIcon />
        </button>
      </div>

      {/* Editorial Manifesto */}
      {playlist.description ? (
        <div className={styles.inspectorBlock}>
          <h3 className={styles.inspectorBlockHeading}>{t("atlas.inspector.manifesto")}</h3>
          <p className={styles.manifestoText}>{playlist.description}</p>
        </div>
      ) : null}

      {playlist.placement_notes ? (
        <div className={styles.inspectorBlock}>
          <h3 className={styles.inspectorBlockHeading}>{t("atlas.inspector.placementNotes")}</h3>
          <p className={styles.placementText}>{playlist.placement_notes}</p>
        </div>
      ) : null}

      {/* Mini Decade Spread */}
      {playlistDecades.length > 0 ? (
        <div className={styles.inspectorBlock}>
          <h3 className={styles.inspectorBlockHeading}>{t("atlas.inspector.decadeSpread")}</h3>
          <div className={styles.miniDecadeBars}>
            {playlistDecades.map((item) => (
              <div key={item.decade} className={styles.miniDecadeRow}>
                <span className={styles.miniDecadeLabel}>{item.label}</span>
                <span className={styles.miniDecadeTrack}>
                  <span
                    className={styles.miniDecadeFill}
                    style={{
                      width: `${Math.max(6, Math.round((item.track_count / maxMiniDecade) * 100))}%`,
                    }}
                  />
                </span>
                <span className={styles.miniDecadeCount}>{item.track_count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Connected Bridge Playlists */}
      {connectedPlaylists.length > 0 ? (
        <div className={styles.inspectorBlock}>
          <h3 className={styles.inspectorBlockHeading}>
            {t("atlas.inspector.connectedPlaylists")} ({connectedPlaylists.length})
          </h3>
          <div className={styles.pillGroup}>
            {connectedPlaylists.map((bridge) => (
              <button
                key={bridge.playlist_slug}
                type="button"
                className={styles.pillButton}
                onClick={() => onSelectPlaylist(bridge.playlist_slug)}
              >
                <span>{bridge.playlist_name}</span>
                <span className={styles.pillMetric}>{bridge.shared_count}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Featured Published Podcast Episodes */}
      {featuredEpisodes.length > 0 ? (
        <div className={styles.inspectorBlock}>
          <h3 className={styles.inspectorBlockHeading}>{t("atlas.inspector.featuredEpisodes")}</h3>
          <ul className={styles.linkedList}>
            {featuredEpisodes.map((ep) => (
              <li key={ep.id}>
                <Link
                  href={`/episodes/${station}/${ep.id}`}
                  className={styles.episodeLinkCard}
                >
                  <div className={styles.episodeLinkTop}>
                    <span>
                      {ep.episode_number !== null
                        ? t("podcasts.episodeNumber", {
                            number: formatEpisodeNumber(ep.episode_number),
                          })
                        : t("nav.podcasts")}
                    </span>
                    {ep.duration ? <span>{formatTrackTime(ep.duration)}</span> : null}
                  </div>
                  <span className={styles.episodeLinkTitle}>{ep.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Today's Scheduled Blocks */}
      <div className={styles.inspectorBlock}>
        <h3 className={styles.inspectorBlockHeading}>{t("atlas.inspector.upcomingBlocks")}</h3>
        {matchingScheduleBlocks.length > 0 ? (
          <ul className={styles.linkedList}>
            {matchingScheduleBlocks.slice(0, 6).map((segment) => (
              <li
                key={`${segment.startTime}-${segment.endTime}`}
                className={styles.scheduleBlockItem}
              >
                <span className={styles.scheduleBlockTime}>
                  {formatBlockTime(segment, viewerTimeZone, locale)}
                </span>
                <span className={styles.scheduleBlockTitle}>
                  {getSegmentTitle(segment, locale)}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.placementText}>{t("atlas.inspector.noUpcomingBlocks")}</p>
        )}
      </div>

      {/* On-Demand Tracklist */}
      <div className={styles.inspectorBlock}>
        <h3 className={styles.inspectorBlockHeading}>
          {t("atlas.inspector.tracksHeading")} ({detail ? filteredTracks.length : playlist.track_count})
        </h3>

        {detailLoading && !detail ? (
          <div className={styles.loadingBar}>
            <span className={styles.loadingDot} aria-hidden="true" />
            <span>{t("atlas.inspector.loadingTracks")}</span>
          </div>
        ) : detailError && !detail ? (
          <div className={styles.emptyState}>
            <p style={{ margin: "0 0 10px" }}>{t("atlas.inspector.errorTracks")}</p>
            <button type="button" className={styles.retryButton} onClick={onRetryDetail}>
              {t("atlas.retry")}
            </button>
          </div>
        ) : detail ? (
          <>
            <div className={styles.tracklistControls}>
              <input
                type="search"
                value={trackQuery}
                onChange={(event) => setTrackQuery(event.target.value)}
                placeholder={t("atlas.inspector.filterTracks")}
                aria-label={t("atlas.inspector.filterTracks")}
                className={styles.searchInput}
              />
              <div className={styles.sortBar}>
                {(
                  [
                    { field: "artist", label: t("atlas.inspector.sortArtist") },
                    { field: "title", label: t("atlas.inspector.sortTitle") },
                    { field: "year", label: t("atlas.inspector.sortYear") },
                  ] as Array<{ field: TrackSortField; label: string }>
                ).map((item) => {
                  const active = sortField === item.field;
                  return (
                    <button
                      key={item.field}
                      type="button"
                      className={`${styles.sortChip} ${active ? styles.sortChipActive : ""}`}
                      aria-pressed={active}
                      onClick={() => handleSortClick(item.field)}
                    >
                      <span>{item.label}</span>
                      {active ? <span aria-hidden="true">{sortDir === "asc" ? "↑" : "↓"}</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredTracks.length === 0 ? (
              <div className={styles.emptyState}>{t("atlas.vault.noResults")}</div>
            ) : (
              <div className={styles.tracklistScroll}>
                <ul className={styles.trackRowList}>
                  {filteredTracks.map((track, index) => (
                    <li
                      key={`${track.artist_slug}-${track.title}-${index}`}
                      className={styles.trackRow}
                    >
                      <div className={styles.trackRowMain}>
                        <span className={styles.trackTitleText}>{track.title}</span>
                        {track.year ? <span className={styles.trackYear}>{track.year}</span> : null}
                      </div>
                      <div className={styles.trackSubRow}>
                        <button
                          type="button"
                          className={styles.inlineArtistButton}
                          onClick={() => onSelectArtist(track.artist_slug)}
                        >
                          {track.artist}
                        </button>
                        {track.album ? <span>· {track.album}</span> : null}
                      </div>
                      {track.other_playlists.length > 0 ? (
                        <div className={styles.otherPlaylistRow}>
                          <span>{t("atlas.inspector.alsoIn")}:</span>
                          {track.other_playlists.map((otherSlug) => (
                            <button
                              key={otherSlug}
                              type="button"
                              className={styles.miniPlaylistPill}
                              onClick={() => onSelectPlaylist(otherSlug)}
                            >
                              {playlistNameBySlug.get(otherSlug) ?? otherSlug}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : null}
      </div>
    </aside>
  );
}
