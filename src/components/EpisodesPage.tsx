"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { PodcastRssActions } from "@/components/PodcastRssActions";
import { formatEpisodeNumber } from "@/lib/episodes";
import { useI18n } from "@/lib/i18n";
import { STATIONS } from "@/lib/stations";
import { formatTrackTime } from "@/lib/trackProgress";
import type { PublishedEpisode } from "@/types/episode";
import type { StationId } from "@/types/radio";
import styles from "./Episodes.module.css";

export function EpisodesPage({ episodes, stationId, rssUrl, unavailable = false }: {
  episodes: PublishedEpisode[];
  stationId: StationId;
  rssUrl?: string;
  unavailable?: boolean;
}) {
  const { t, locale } = useI18n();
  const station = STATIONS.find((item) => item.id === stationId)!;
  const stationThemeClass = stationId === "neuralforge" ? styles.themeForge : styles.themeCast;
  // Number each series chronologically, then list newest first. Adding a new
  // episode leaves the existing episodes' numbers unchanged.
  const chronological = episodes.filter((episode) => episode.station === stationId)
    .sort((a, b) => a.published_at.localeCompare(b.published_at) || a.id.localeCompare(b.id));
  const numbered = chronological
    .map((episode, index) => ({ episode, number: episode.episode_number ?? index + 1 }))
    .reverse();

  return (
    <div className="appShell">
      <SiteHeader podcastStation={stationId} />
      <main
        className={`${styles.page} ${stationThemeClass}`}
        style={{ "--station-accent": station.accentColor } as CSSProperties}
      >
        <header className={styles.podcastHeader}>
          <div className={styles.podcastIntro}>
            <h1>{t("nav.podcasts")}</h1>
            <p>{t("episodes.intro")}</p>
          </div>
          <nav className={styles.seriesSelector} aria-label={t("podcasts.selectSeries")}>
            {STATIONS.map((item) => (
              <Link
                key={item.id}
                href={`/episodes?station=${item.id}`}
                className={`${styles.seriesOption} ${item.id === "neuralforge" ? styles.seriesForge : styles.seriesCast}`}
                aria-label={`${item.name} ${t("nav.podcasts")}`}
                aria-current={stationId === item.id ? "page" : undefined}
              >
                <img src={item.podcastArtworkImage} alt="" width={34} height={34} />
                <strong>{item.name}</strong>
              </Link>
            ))}
          </nav>
        </header>

        <div className={styles.seriesHeading}>
          <div className={styles.seriesTitleRow}>
            <h2>{station.name}</h2>
            <span className={styles.seriesCount}>
              {numbered.length} {t("episodes.title").toLocaleLowerCase(locale)}
            </span>
          </div>
          <div className={styles.seriesMeta}>
            <PodcastRssActions rssUrl={rssUrl} stationName={station.name} />
          </div>
        </div>

        {unavailable ? (
          <p className={styles.unavailableMessage} role="alert">{t("episodes.unavailable")}</p>
        ) : numbered.length === 0 ? (
          <div className={styles.empty}>
            <p>{t("episodes.empty")}</p>
            <Link href="/">{t("episodes.live")} →</Link>
          </div>
        ) : (
          <ol className={styles.episodeGrid} aria-label={`${station.name} · ${t("episodes.title")}`}>
            {numbered.map(({ episode, number }, index) => {
              const isFeatured = index === 0;
              const dateText = new Date(episode.published_at).toLocaleDateString(locale, {
                timeZone: "UTC",
                day: "numeric",
                month: "short",
                year: "numeric"
              });
              const languageName = new Intl.DisplayNames([locale], { type: "language" }).of(
                episode.language.split("-")[0]
              );
              const musicChapters = (episode.chapters ?? []).filter((chapter) => chapter.kind === "music");

              return (
                <li
                  key={episode.id}
                  value={number}
                  className={isFeatured ? styles.featuredItem : styles.archiveItem}
                >
                  <Link
                    className={isFeatured ? styles.featuredCard : styles.archiveCard}
                    href={`/episodes/${episode.station}/${episode.id}`}
                  >
                    <div className={isFeatured ? styles.featuredArtwork : styles.archiveArtwork}>
                      <img
                        src={station.podcastArtworkImage}
                        alt=""
                        width={isFeatured ? 220 : 84}
                        height={isFeatured ? 220 : 84}
                        loading={isFeatured ? "eager" : "lazy"}
                      />
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.cardMetaRow}>
                        <time dateTime={episode.published_at}>{dateText}</time>
                        <span aria-hidden="true">·</span>
                        <span>{formatTrackTime(episode.duration)}</span>
                        {languageName ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{languageName}</span>
                          </>
                        ) : null}
                      </div>
                      <h3 className={isFeatured ? styles.featuredTitle : styles.archiveTitle}>
                        <span
                          className={styles.episodeNumber}
                          aria-label={t("podcasts.episodeNumber", { number: String(number) })}
                        >
                          {formatEpisodeNumber(number)}
                          <span className={styles.numberSeparator} aria-hidden="true"> · </span>
                        </span>
                        {episode.title}
                      </h3>
                      <p className={isFeatured ? styles.featuredDescription : styles.archiveDescription}>
                        {episode.description}
                      </p>
                      {isFeatured && musicChapters.length > 0 ? (
                        <p className={styles.featuredTrackPreview}>
                          {musicChapters
                            .slice(0, 4)
                            .map((chapter) => (chapter.artist ? `${chapter.artist} - ${chapter.title}` : chapter.title))
                            .join(" · ")}
                        </p>
                      ) : null}
                      <span className={isFeatured ? styles.featuredCta : styles.archiveCta} aria-hidden="true">
                        {isFeatured ? t("episodes.listen") : t("episodes.open")} →
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </div>
  );
}
