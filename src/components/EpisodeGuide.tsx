"use client";

import { useI18n } from "@/lib/i18n";
import { formatTrackTime } from "@/lib/trackProgress";
import type { HostCompanion } from "@/types/hostCompanion";
import styles from "./HostCompanionCard.module.css";

export function EpisodeGuide({ card, currentTime, fallbackArtwork }: { card: HostCompanion; currentTime: number; fallbackArtwork: string }) {
  const { t } = useI18n();
  if (!card.episode) return null;
  const elapsed = Math.max(0, Math.min(card.episode.duration, currentTime / 1000 - card.expected_start));
  const finished = currentTime / 1000 >= card.expected_end;
  return <div className={styles.episodeGuide}>
    <div className={styles.episodeProgress}>
      <span>{finished ? t("companion.episodeEnded") : t("companion.episodeProgress")}</span>
      <strong>{formatTrackTime(elapsed)} / {formatTrackTime(card.episode.duration)}</strong>
      <progress max={card.episode.duration} value={elapsed} aria-label={t("companion.episodeProgress")} />
    </div>
    <ol className={styles.chapters}>
      {card.episode.chapters.map((chapter) => {
        const active = !finished && elapsed >= chapter.start && elapsed < chapter.end;
        return <li key={chapter.id} className={`${styles.chapter} ${active ? styles.currentChapter : ""}`} aria-current={active ? "step" : undefined}>
          <div className={styles.chapterTime}><span>{formatTrackTime(chapter.start)}</span>{active ? <strong>{t("companion.playingChapter")}</strong> : null}</div>
          {chapter.kind === "music" ? <div className={styles.chapterTrack}>
            <img src={chapter.art_url || fallbackArtwork} alt="" loading="lazy" onError={(event) => { if (event.currentTarget.getAttribute("src") !== fallbackArtwork) event.currentTarget.src = fallbackArtwork; }} />
            <div><h3>{chapter.title}</h3><strong>{chapter.artist}</strong>{chapter.album ? <span>{chapter.album}{chapter.year ? ` · ${chapter.year}` : ""}</span> : null}</div>
          </div> : <h3>{chapter.title}</h3>}
          <p>{chapter.kind === "music" ? chapter.rationale : chapter.summary}</p>
          {chapter.key_points?.length ? <ul className={styles.points}>{chapter.key_points.map((point, index) => <li key={index}>{point}</li>)}</ul> : null}
          {chapter.sources?.length ? <div className={styles.chapterSources}>{chapter.sources.flatMap((source, index) => {
            let url: URL;
            try { url = new URL(source.url); } catch { return []; }
            if (!["http:", "https:"].includes(url.protocol) || url.username) return [];
            return <a key={index} href={url.href} target="_blank" rel="noopener noreferrer" title={source.claim}>{url.hostname} ↗</a>;
          })}</div> : null}
        </li>;
      })}
    </ol>
  </div>;
}
