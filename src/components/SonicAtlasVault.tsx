"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CloseIcon } from "@/components/CloseIcon";
import { formatEpisodeNumber } from "@/lib/episodes";
import { useI18n } from "@/lib/i18n";
import { formatTrackTime } from "@/lib/trackProgress";
import type {
  AtlasArtistEntry,
  AtlasArtistTrack,
  AtlasEpisodeRef,
  AtlasPlaylistNode,
  RotationRole,
} from "@/types/atlas";
import type { StationId } from "@/types/radio";
import styles from "./SonicAtlas.module.css";

interface SonicAtlasVaultProps {
  station: StationId;
  artists: AtlasArtistEntry[];
  playlists: AtlasPlaylistNode[];
  episodes: AtlasEpisodeRef[];
  selectedDecades: number[];
  selectedArtistSlug: string | null;
  onSelectArtist: (slug: string | null) => void;
  onSelectPlaylist: (slug: string) => void;
}

type VaultTab = "artists" | "tracks" | "playlists";

interface FlattenedTrack extends AtlasArtistTrack {
  artistSlug: string;
}

const MAX_VISIBLE_ARTISTS = 48;
const MAX_VISIBLE_TRACKS = 80;

function formatEra(minYear: number | null, maxYear: number | null): string {
  if (minYear && maxYear) {
    return minYear === maxYear ? String(minYear) : `${minYear}–${maxYear}`;
  }
  if (minYear) return `${minYear}–`;
  if (maxYear) return `–${maxYear}`;
  return "—";
}

function yearMatchesDecades(year: number | null, selectedDecades: number[]): boolean {
  if (selectedDecades.length === 0) return true;
  if (year === null) return false;
  const decade = Math.floor(year / 10) * 10;
  return selectedDecades.includes(decade);
}

function roleBadgeClass(role: RotationRole): string {
  if (role === "open_only") return styles.roleOpen;
  if (role === "reserved_window") return styles.roleReserved;
  return styles.roleThemed;
}

export function SonicAtlasVault({
  station,
  artists,
  playlists,
  episodes,
  selectedDecades,
  selectedArtistSlug,
  onSelectArtist,
  onSelectPlaylist,
}: SonicAtlasVaultProps) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<VaultTab>("artists");

  const playlistNameBySlug = useMemo(() => {
    const map = new Map<string, string>();
    for (const pl of playlists) {
      map.set(pl.slug, pl.name);
    }
    return map;
  }, [playlists]);

  const episodeById = useMemo(() => {
    const map = new Map<string, AtlasEpisodeRef>();
    for (const ep of episodes) {
      map.set(ep.id, ep);
    }
    return map;
  }, [episodes]);

  const selectedArtist = useMemo(() => {
    if (!selectedArtistSlug) return null;
    return artists.find((a) => a.slug === selectedArtistSlug) ?? null;
  }, [artists, selectedArtistSlug]);

  // Flatten all unique tracks across station once per station payload
  const allTracks = useMemo<FlattenedTrack[]>(() => {
    const out: FlattenedTrack[] = [];
    for (const artist of artists) {
      for (const track of artist.tracks) {
        out.push({ ...track, artistSlug: artist.slug });
      }
    }
    return out;
  }, [artists]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredArtists = useMemo(() => {
    return artists.filter((artist) => {
      if (selectedDecades.length > 0) {
        const hasDecadeTrack = artist.tracks.some((tr) =>
          yearMatchesDecades(tr.year, selectedDecades)
        );
        if (!hasDecadeTrack) return false;
      }
      if (!normalizedQuery) return true;
      if (artist.name.toLowerCase().includes(normalizedQuery)) return true;
      if (
        artist.playlists.some((slug) =>
          (playlistNameBySlug.get(slug) ?? slug).toLowerCase().includes(normalizedQuery)
        )
      ) {
        return true;
      }
      return artist.tracks.some(
        (tr) =>
          tr.title.toLowerCase().includes(normalizedQuery) ||
          tr.album.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [artists, normalizedQuery, playlistNameBySlug, selectedDecades]);

  const filteredTracks = useMemo(() => {
    return allTracks.filter((track) => {
      if (!yearMatchesDecades(track.year, selectedDecades)) return false;
      if (!normalizedQuery) return true;
      return (
        track.title.toLowerCase().includes(normalizedQuery) ||
        track.artist.toLowerCase().includes(normalizedQuery) ||
        track.album.toLowerCase().includes(normalizedQuery) ||
        (track.year !== null && String(track.year).includes(normalizedQuery)) ||
        track.playlists.some((slug) =>
          (playlistNameBySlug.get(slug) ?? slug).toLowerCase().includes(normalizedQuery)
        )
      );
    });
  }, [allTracks, normalizedQuery, playlistNameBySlug, selectedDecades]);

  const filteredPlaylists = useMemo(() => {
    return playlists.filter((pl) => {
      if (selectedDecades.length > 0) {
        const matches = selectedDecades.some((d) => (pl.decades[String(d)] ?? 0) > 0);
        if (!matches) return false;
      }
      if (!normalizedQuery) return true;
      return (
        pl.name.toLowerCase().includes(normalizedQuery) ||
        pl.description.toLowerCase().includes(normalizedQuery) ||
        pl.top_artists.some((a) => a.name.toLowerCase().includes(normalizedQuery))
      );
    });
  }, [normalizedQuery, playlists, selectedDecades]);

  const dossierEpisodes = useMemo(() => {
    if (!selectedArtist) return [];
    return selectedArtist.episode_ids
      .map((id) => episodeById.get(id))
      .filter((ep): ep is AtlasEpisodeRef => Boolean(ep));
  }, [episodeById, selectedArtist]);

  return (
    <section className={styles.vaultSection} aria-labelledby="atlas-vault-heading">
      <div className={styles.vaultTop}>
        <div className={styles.sectionHeadingGroup}>
          <h2 id="atlas-vault-heading" className={styles.sectionTitle}>
            {t("atlas.vault.title")}
          </h2>
          <p className={styles.sectionSubtitle}>{t("atlas.vault.subtitle")}</p>
        </div>
      </div>

      {selectedArtist ? (
        <article className={styles.dossierCard} aria-label={selectedArtist.name} data-artist-dossier={selectedArtist.slug}>
          <div className={styles.dossierHeader}>
            <div>
              <h3>{selectedArtist.name}</h3>
              <div className={styles.inspectorMetaChips}>
                <span className={styles.metaChip}>
                  {t("atlas.timeline.tracksLabel", { count: selectedArtist.track_count })}
                </span>
                <span className={styles.metaChip}>
                  {t("atlas.vault.eraSpan")}:{" "}
                  {formatEra(selectedArtist.min_year, selectedArtist.max_year)}
                </span>
                <span className={styles.metaChip}>
                  {selectedArtist.playlists.length} {t("atlas.vault.playlistsSpanned").toLowerCase()}
                </span>
              </div>
            </div>
            <button
              type="button"
              className={styles.backButton}
              onClick={() => onSelectArtist(null)}
            >
              ← {t("atlas.vault.backToResults")}
            </button>
          </div>

          <div className={styles.inspectorBlock}>
            <h4 className={styles.inspectorBlockHeading}>{t("atlas.vault.playlistsSpanned")}</h4>
            <div className={styles.pillGroup}>
              {selectedArtist.playlists.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  className={styles.pillButton}
                  onClick={() => onSelectPlaylist(slug)}
                >
                  {playlistNameBySlug.get(slug) ?? slug}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.dossierColumns}>
            <div className={styles.dossierSubColumn}>
              <div className={styles.inspectorBlock}>
                <h4 className={styles.inspectorBlockHeading}>
                  {t("atlas.vault.tracksOnStation")} ({selectedArtist.tracks.length})
                </h4>
                <div className={styles.vaultTrackTableWrap}>
                  <table className={styles.vaultTrackTable}>
                    <thead>
                      <tr>
                        <th>{t("atlas.inspector.colTitle")}</th>
                        <th>{t("atlas.inspector.colAlbum")}</th>
                        <th>{t("atlas.inspector.colYear")}</th>
                        <th>{t("atlas.vault.playlistsSpanned")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedArtist.tracks.map((track, idx) => (
                        <tr key={`${track.title}-${track.album}-${idx}`}>
                          <td>
                            <strong>{track.title}</strong>
                          </td>
                          <td>{track.album || "—"}</td>
                          <td>{track.year ?? "—"}</td>
                          <td>
                            <div className={styles.pillGroup}>
                              {track.playlists.map((slug) => (
                                <button
                                  key={slug}
                                  type="button"
                                  className={styles.miniPlaylistPill}
                                  onClick={() => onSelectPlaylist(slug)}
                                >
                                  {playlistNameBySlug.get(slug) ?? slug}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className={styles.dossierSubColumn}>
              {dossierEpisodes.length > 0 ? (
                <div className={styles.inspectorBlock}>
                  <h4 className={styles.inspectorBlockHeading}>
                    {t("atlas.vault.linkedEpisodes")}
                  </h4>
                  <ul className={styles.linkedList}>
                    {dossierEpisodes.map((ep) => (
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

              {selectedArtist.host_stories.length > 0 ? (
                <div className={styles.inspectorBlock}>
                  <h4 className={styles.inspectorBlockHeading}>
                    {t("atlas.vault.hostStories")}
                  </h4>
                  <ul className={styles.linkedList}>
                    {selectedArtist.host_stories.map((story, idx) => (
                      <li key={`${story.title}-${idx}`} className={styles.storyCard}>
                        <div className={styles.storyMeta}>
                          <span>{story.archetype.replaceAll("_", " ")}</span>
                          {story.created_at ? (
                            <time dateTime={story.created_at}>
                              {new Date(story.created_at).toLocaleDateString(locale, {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </time>
                          ) : null}
                        </div>
                        <p className={styles.storyTitle}>{story.title}</p>
                        {story.summary ? (
                          <p className={styles.storySummary}>{story.summary}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </article>
      ) : (
        <>
          <div className={styles.vaultSearchRow}>
            <div className={styles.vaultSearchWrap}>
              <svg
                className={styles.vaultSearchIcon}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("atlas.vault.searchPlaceholder")}
                aria-label={t("atlas.vault.searchPlaceholder")}
                className={styles.vaultSearchInput}
              />
              {query ? (
                <button
                  type="button"
                  className={styles.vaultClearButton}
                  onClick={() => setQuery("")}
                  aria-label={t("atlas.vault.clearSearch")}
                >
                  <CloseIcon size={14} />
                </button>
              ) : null}
            </div>

            <div className={styles.vaultTabs} role="tablist" aria-label={t("atlas.vault.title")}>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "artists"}
                className={`${styles.vaultTab} ${activeTab === "artists" ? styles.vaultTabActive : ""}`}
                onClick={() => setActiveTab("artists")}
              >
                <span>{t("atlas.vault.tabArtists")}</span>
                <span className={styles.vaultTabCount}>{filteredArtists.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "tracks"}
                className={`${styles.vaultTab} ${activeTab === "tracks" ? styles.vaultTabActive : ""}`}
                onClick={() => setActiveTab("tracks")}
              >
                <span>{t("atlas.vault.tabTracks")}</span>
                <span className={styles.vaultTabCount}>{filteredTracks.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "playlists"}
                className={`${styles.vaultTab} ${activeTab === "playlists" ? styles.vaultTabActive : ""}`}
                onClick={() => setActiveTab("playlists")}
              >
                <span>{t("atlas.vault.tabPlaylists")}</span>
                <span className={styles.vaultTabCount}>{filteredPlaylists.length}</span>
              </button>
            </div>
          </div>

          {activeTab === "artists" ? (
            filteredArtists.length === 0 ? (
              <div className={styles.emptyState}>{t("atlas.vault.noResults")}</div>
            ) : (
              <>
                {filteredArtists.length > MAX_VISIBLE_ARTISTS ? (
                  <p className={styles.vaultMetaNote}>
                    {t("atlas.vault.showingTop", {
                      shown: MAX_VISIBLE_ARTISTS,
                      total: filteredArtists.length,
                    })}
                  </p>
                ) : null}
                <div className={styles.artistGrid}>
                  {filteredArtists.slice(0, MAX_VISIBLE_ARTISTS).map((artist) => (
                    <button
                      key={artist.slug}
                      type="button"
                      className={styles.artistCard}
                      onClick={() => onSelectArtist(artist.slug)}
                    >
                      <div className={styles.artistCardTop}>
                        <span className={styles.artistCardName}>{artist.name}</span>
                        <span className={styles.artistCardStats}>
                          {t("atlas.timeline.tracksLabel", { count: artist.track_count })}
                        </span>
                      </div>
                      <div className={styles.playlistListCardMeta}>
                        <span>{formatEra(artist.min_year, artist.max_year)}</span>
                        <span>·</span>
                        <span>
                          {artist.playlists.length}{" "}
                          {t("atlas.vault.playlistsSpanned").toLowerCase()}
                        </span>
                      </div>
                      <div className={styles.artistCardTags}>
                        {artist.playlists.slice(0, 3).map((slug) => (
                          <span key={slug} className={styles.artistPlaylistTag}>
                            {playlistNameBySlug.get(slug) ?? slug}
                          </span>
                        ))}
                        {artist.playlists.length > 3 ? (
                          <span className={styles.artistPlaylistTag}>
                            +{artist.playlists.length - 3}
                          </span>
                        ) : null}
                        {artist.episode_ids.length > 0 ? (
                          <span className={styles.goldBadge}>{t("nav.podcasts")}</span>
                        ) : null}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )
          ) : null}

          {activeTab === "tracks" ? (
            filteredTracks.length === 0 ? (
              <div className={styles.emptyState}>{t("atlas.vault.noResults")}</div>
            ) : (
              <>
                {filteredTracks.length > MAX_VISIBLE_TRACKS ? (
                  <p className={styles.vaultMetaNote}>
                    {t("atlas.vault.showingTop", {
                      shown: MAX_VISIBLE_TRACKS,
                      total: filteredTracks.length,
                    })}
                  </p>
                ) : null}
                <div className={styles.vaultTrackTableWrap}>
                  <table className={styles.vaultTrackTable}>
                    <thead>
                      <tr>
                        <th>{t("atlas.inspector.colTitle")}</th>
                        <th>{t("atlas.inspector.colArtist")}</th>
                        <th>{t("atlas.inspector.colAlbum")}</th>
                        <th>{t("atlas.inspector.colYear")}</th>
                        <th>{t("atlas.vault.playlistsSpanned")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTracks.slice(0, MAX_VISIBLE_TRACKS).map((track, idx) => (
                        <tr key={`${track.artistSlug}-${track.title}-${idx}`}>
                          <td>
                            <strong>{track.title}</strong>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={styles.inlineArtistButton}
                              onClick={() => onSelectArtist(track.artistSlug)}
                            >
                              {track.artist}
                            </button>
                          </td>
                          <td>{track.album || "—"}</td>
                          <td>{track.year ?? "—"}</td>
                          <td>
                            <div className={styles.pillGroup}>
                              {track.playlists.map((slug) => (
                                <button
                                  key={slug}
                                  type="button"
                                  className={styles.miniPlaylistPill}
                                  onClick={() => onSelectPlaylist(slug)}
                                >
                                  {playlistNameBySlug.get(slug) ?? slug}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )
          ) : null}

          {activeTab === "playlists" ? (
            filteredPlaylists.length === 0 ? (
              <div className={styles.emptyState}>{t("atlas.vault.noResults")}</div>
            ) : (
              <div className={styles.artistGrid}>
                {filteredPlaylists.map((pl) => (
                  <button
                    key={pl.slug}
                    type="button"
                    className={styles.artistCard}
                    onClick={() => onSelectPlaylist(pl.slug)}
                  >
                    <div className={styles.playlistListCardTop}>
                      <span className={styles.artistCardName}>{pl.name}</span>
                      <span className={`${styles.roleBadge} ${roleBadgeClass(pl.rotation_role)}`}>
                        {t(`atlas.role.${pl.rotation_role}`)}
                      </span>
                    </div>
                    <div className={styles.playlistListCardMeta}>
                      <span>{t("atlas.timeline.tracksLabel", { count: pl.track_count })}</span>
                      <span>·</span>
                      <span>{formatEra(pl.min_year, pl.max_year)}</span>
                    </div>
                    {pl.description ? (
                      <p className={styles.storySummary}>
                        {pl.description.length > 130
                          ? `${pl.description.slice(0, 128).trimEnd()}…`
                          : pl.description}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            )
          ) : null}
        </>
      )}
    </section>
  );
}
