"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { formatTrackTime } from "@/lib/trackProgress";
import type { HostCompanion } from "@/types/hostCompanion";
import styles from "./HostCompanionCard.module.css";

export function EpisodeGuide({ card, currentTime = 0, fallbackArtwork, position, onSeek }: { card: HostCompanion; currentTime?: number; fallbackArtwork: string; position?: number; onSeek?: (seconds: number) => void }) {
  const { t } = useI18n();
  if (!card.episode) return null;
  const elapsed = Math.max(0, Math.min(card.episode.duration, position ?? (currentTime / 1000 - card.expected_start)));
  const finished = position !== undefined ? position >= card.episode.duration : currentTime / 1000 >= card.expected_end;
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
          <div className={styles.chapterTime}>{onSeek ? <button className={styles.chapterSeek} type="button" onClick={() => onSeek(chapter.start)} aria-label={`${t("episodes.jumpTo")} ${chapter.title}`}>{formatTrackTime(chapter.start)} ↗</button> : <span>{formatTrackTime(chapter.start)}</span>}{active ? <strong>{t(position !== undefined ? "episodes.currentChapter" : "companion.playingChapter")}</strong> : null}</div>
          {chapter.kind === "music" ? <div className={styles.chapterTrack}>
            <ChapterArtwork src={chapter.art_url} fallback={fallbackArtwork} />
            <div><h3>{chapter.title}</h3><strong>{chapter.artist}</strong>{chapter.album ? <span>{chapter.album}{chapter.year ? ` · ${chapter.year}` : ""}</span> : null}</div>
          </div> : <h3>{chapter.title}</h3>}
          {((chapter.kind === "music" ? chapter.rationale : chapter.summary) || chapter.key_points?.length || chapter.sources?.length) ? <div className={styles.chapterDetails}>
            <p>{chapter.kind === "music" ? chapter.rationale : chapter.summary}</p>
            {chapter.key_points?.length ? <ul className={styles.points}>{chapter.key_points.map((point, index) => <li key={index}>{point}</li>)}</ul> : null}
            {chapter.sources?.length ? <div className={styles.chapterSources}>{chapter.sources.flatMap((source, index) => {
              let url: URL;
              try { url = new URL(source.url); } catch { return []; }
              if (!["http:", "https:"].includes(url.protocol) || url.username) return [];
              return <a key={index} href={url.href} target="_blank" rel="noopener noreferrer" title={`${source.claim ? source.claim + " · " : ""}${url.hostname}`} aria-label={`${t("companion.source")} ${index + 1}: ${source.claim || url.hostname}`}>{t("companion.source")}{chapter.sources!.length > 1 ? ` ${index + 1}` : ""} <span aria-hidden="true">↗</span></a>;
            })}</div> : null}
          </div> : null}
        </li>;
      })}
    </ol>
  </div>;
}

function ChapterArtwork({ src, fallback }: { src?: string | null; fallback: string }) {
  const [failed, setFailed] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    // An SSR image can fail before React attaches its error listener.
    if (ref.current?.complete && ref.current.naturalWidth === 0) setFailed(true);
  }, [src]);
  return <img ref={ref} src={!failed && src ? src : fallback} alt="" loading="lazy" onError={() => setFailed(true)} />;
}
