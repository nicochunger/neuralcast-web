"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { EpisodeControls } from "@/components/EpisodeControls";
import { EpisodeGuide } from "@/components/EpisodeGuide";
import { useEpisodePlayer } from "@/context/EpisodePlayerContext";
import { useI18n } from "@/lib/i18n";
import { STATIONS } from "@/lib/stations";
import type { PublishedEpisode } from "@/types/episode";
import type { HostCompanion } from "@/types/hostCompanion";
import styles from "./Episodes.module.css";

export function EpisodePage({ episode }: { episode: PublishedEpisode }) {
  const { t, locale } = useI18n();
  const player = useEpisodePlayer();
  const [showGuide, setShowGuide] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const station = STATIONS.find((item) => item.id === episode.station)!;
  const selected = player.episode?.id === episode.id && player.episode.station === episode.station && player.episode.revision === episode.revision;
  const position = selected ? player.position : 0;
  const card: HostCompanion = {
    id: episode.id, channel: episode.channel, archetype: "episode", expected_start: 0,
    expected_end: episode.duration, expires_at: 0, transcript: episode.transcript ?? "",
    content: { title: episode.title, summary: episode.description, key_points: [], items: [] },
    episode: { media_id: episode.id, duration: episode.duration, chapters: episode.chapters ?? [] }
  };
  const seek = (seconds: number) => {
    if (selected && player.active) player.seek(seconds);
    else { void player.play(episode, seconds); }
  };
  useEffect(() => {
    if (showGuide && !dialog.current?.open) dialog.current?.showModal();
    else if (!showGuide && dialog.current?.open) dialog.current.close();
  }, [showGuide]);
  const guide = <EpisodeGuide card={card} position={position} fallbackArtwork={station.artworkImage} onSeek={seek} />;
  return <div className="appShell"><SiteHeader podcastStation={episode.station} /><main className={styles.page}>
    <Link className={styles.back} href={`/episodes?station=${episode.station}`}>← {t("episodes.back")}</Link>
    <div className={styles.detailGrid}>
      <article className={styles.mainColumn}>
        <section className={styles.playerCard} aria-labelledby="episode-title" style={{
          "--station-accent": station.accentColor
        } as CSSProperties}>
          <div className={styles.playerCardContent}>
            <div className={styles.playerTopline}><strong>{station.name}</strong><span>{t("nav.podcasts")}</span></div>
            <div className={styles.playerIdentity}>
              <img src={station.artworkImage} alt="" width={112} height={112} />
              <div><h1 id="episode-title">{episode.title}</h1><p>{new Intl.DisplayNames([locale], { type: "language" }).of(episode.language.split("-")[0])} · <time dateTime={episode.published_at}>{new Date(episode.published_at).toLocaleDateString(locale, { timeZone: "UTC" })}</time></p></div>
            </div>
            <p className={styles.playerDescription}>{episode.description}</p>
            <EpisodeControls episode={episode} />
            <button className={styles.mobileGuideButton} type="button" onClick={() => setShowGuide(true)}>{t("episodes.guide")} ↗</button>
          </div>
        </section>
        <button className={styles.transcriptToggle} type="button" aria-expanded={showTranscript} onClick={() => setShowTranscript((value) => !value)}>{t(showTranscript ? "companion.hideTranscript" : "companion.readTranscript")}</button>
        {showTranscript ? <div className={styles.transcript}>{episode.transcript}</div> : null}
      </article>
      <aside className={styles.desktopGuide} aria-label={t("episodes.guide")}><h2>{t("episodes.guide")}</h2>{guide}</aside>
    </div>
    <dialog ref={dialog} className={styles.guideDialog} onCancel={() => setShowGuide(false)} onClick={(event) => { if (event.target === event.currentTarget) setShowGuide(false); }} aria-labelledby="episode-guide-title">
      <div className={styles.dialogContent}><div className={styles.dialogHeader}><h2 id="episode-guide-title">{t("episodes.guide")}</h2><button type="button" onClick={() => setShowGuide(false)} aria-label={t("episodes.closeGuide")}>✕</button></div>{guide}</div>
    </dialog>
  </main></div>;
}
