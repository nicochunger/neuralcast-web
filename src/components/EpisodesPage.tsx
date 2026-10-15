"use client";

import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { useI18n } from "@/lib/i18n";
import { STATIONS } from "@/lib/stations";
import { formatTrackTime } from "@/lib/trackProgress";
import type { PublishedEpisode } from "@/types/episode";
import type { StationId } from "@/types/radio";
import styles from "./Episodes.module.css";

export function EpisodesPage({ episodes, stationId, unavailable = false }: {
  episodes: PublishedEpisode[];
  stationId: StationId;
  unavailable?: boolean;
}) {
  const { t, locale } = useI18n();
  const station = STATIONS.find((item) => item.id === stationId)!;
  // Number each series chronologically, then list newest first. Adding a new
  // episode leaves the existing episodes' numbers unchanged.
  const chronological = episodes.filter((episode) => episode.station === stationId)
    .sort((a, b) => a.published_at.localeCompare(b.published_at) || a.id.localeCompare(b.id));
  const numbered = chronological.map((episode, index) => ({ episode, number: index + 1 })).reverse();

  return <div className="appShell"><SiteHeader podcastStation={stationId} /><main className={styles.page}>
    <div className={styles.podcastIntro}><p>{t("episodes.intro")}</p></div>
    <nav className={styles.seriesSelector} aria-label={t("podcasts.selectSeries")}>
      {STATIONS.map((item) => <Link key={item.id} href={`/episodes?station=${item.id}`}
        className={styles.seriesOption} aria-current={stationId === item.id ? "page" : undefined}>
        <img src={item.artworkImage} alt="" width={48} height={48} />
        <span><strong>{item.name}</strong><span>{t("nav.podcasts")}</span></span>
      </Link>)}
    </nav>
    <div className={styles.seriesHeading}><div><p className={styles.eyebrow}>{t("podcasts.series")}</p><h2>{station.name}</h2></div><span>{numbered.length} {t("episodes.title").toLocaleLowerCase(locale)}</span></div>
    {unavailable ? <p role="alert">{t("episodes.unavailable")}</p> : numbered.length === 0 ? <div className={styles.empty}><p>{t("episodes.empty")}</p><Link href="/">{t("episodes.live")} →</Link></div> : <ol className={styles.episodeList} aria-label={`${station.name} · ${t("episodes.title")}`}>
      {numbered.map(({ episode, number }) => <li key={episode.id} value={number}>
        <Link className={styles.episodeRow} href={`/episodes/${episode.station}/${episode.id}`}>
          <div className={styles.rowArtwork}><img src={station.artworkImage} alt="" /></div>
          <div className={styles.rowCopy}>
            <p className={styles.eyebrow}>{new Intl.DisplayNames([locale], { type: "language" }).of(episode.language.split("-")[0])} · {formatTrackTime(episode.duration)} · <time dateTime={episode.published_at}>{new Date(episode.published_at).toLocaleDateString(locale, { timeZone: "UTC" })}</time></p>
            <h3><span className={styles.episodeNumber} aria-label={t("podcasts.episodeNumber", { number: String(number) })}>#{number}<span className={styles.numberSeparator} aria-hidden="true"> · </span></span>{episode.title}</h3><p className={styles.rowDescription}>{episode.description}</p>
            <span className={styles.rowListen}>{t("episodes.open")} <span aria-hidden="true">→</span></span>
          </div>
        </Link>
      </li>)}
    </ol>}
  </main></div>;
}
