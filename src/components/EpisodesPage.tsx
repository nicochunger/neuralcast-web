"use client";
import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { useI18n } from "@/lib/i18n";
import { STATIONS } from "@/lib/stations";
import { formatTrackTime } from "@/lib/trackProgress";
import type { PublishedEpisode } from "@/types/episode";
import styles from "./Episodes.module.css";

export function EpisodesPage({ episodes, unavailable = false }: { episodes: PublishedEpisode[]; unavailable?: boolean }) {
  const { t, locale } = useI18n();
  const [filter, setFilter] = useState("all");
  const visible = episodes.filter((episode) => filter === "all" || episode.station === filter);
  return <div className="appShell"><SiteHeader /><main className={styles.page}>
    <div className={styles.intro}><p className={styles.eyebrow}>NeuralCast / NeuralForge</p><h1>{t("episodes.title")}</h1><p>{t("episodes.intro")}</p></div>
    <div className={styles.filters} role="group" aria-label={t("episodes.title")}>
      {[{ id: "all", name: t("episodes.all") }, ...STATIONS].map((station) => <button type="button" key={station.id} aria-pressed={filter === station.id} onClick={() => setFilter(station.id)}>{station.name}</button>)}
    </div>
    {unavailable ? <p role="alert">{t("episodes.unavailable")}</p> : visible.length === 0 ? <div className={styles.empty}><p>{t("episodes.empty")}</p><Link href="/">{t("episodes.live")} →</Link></div> : <div className={styles.grid}>
      {visible.map((episode) => {
        const station = STATIONS.find((item) => item.id === episode.station)!;
        return <Link className={styles.episodeCard} href={`/episodes/${episode.station}/${episode.id}`} key={`${episode.station}/${episode.id}`}>
          <img className={styles.cover} src={station.artworkImage} alt="" />
          <div className={styles.cardCopy}><p className={styles.eyebrow}>{station.name} · {new Intl.DisplayNames([locale], { type: "language" }).of(episode.language.split("-")[0])} · {formatTrackTime(episode.duration)}</p>
          <h2>{episode.title}</h2><p>{episode.description}</p><span className={styles.cardAction}>{t("episodes.listen")} →</span></div>
        </Link>;
      })}
    </div>}
  </main></div>;
}
