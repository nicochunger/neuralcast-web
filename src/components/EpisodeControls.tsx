"use client";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import type { PublishedEpisode } from "@/types/episode";
import { useEpisodePlayer } from "@/context/EpisodePlayerContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useI18n } from "@/lib/i18n";
import { formatTrackTime } from "@/lib/trackProgress";
import styles from "./Episodes.module.css";

export function EpisodeControls({ episode, compact = false }: { episode: PublishedEpisode; compact?: boolean }) {
  const player = useEpisodePlayer();
  const { t } = useI18n();
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const selected = player.episode?.station === episode.station && player.episode.id === episode.id && player.episode.revision === episode.revision;
  const position = selected ? player.position : 0;
  const playing = selected && player.active && ["playing", "buffering"].includes(player.state);
  const buffering = selected && player.active && player.state === "buffering";
  const skip = (seconds: number) => player.seek(Math.min(episode.duration, Math.max(0, position + seconds)));
  const elapsed = formatTrackTime(position);
  const duration = formatTrackTime(episode.duration);
  const chapters = !compact && episode.chapters?.length && episode.duration > 0
    ? episode.chapters
        .map((chapter) => {
          const start = Math.min(episode.duration, Math.max(0, chapter.start));
          const end = Math.min(episode.duration, Math.max(start, chapter.end));
          return { ...chapter, start, end };
        })
        .filter((chapter) => chapter.end > chapter.start)
    : [];
  const hasChapters = chapters.length > 0;
  const findChapterAt = (time: number) =>
    chapters.find((chapter) => time >= chapter.start && time <= chapter.end) ?? chapters[chapters.length - 1] ?? null;
  const hoveredChapter = hasChapters && hoveredTime !== null ? findChapterAt(hoveredTime) : null;
  const activeChapter = hasChapters && selected && player.active ? findChapterAt(position) : null;
  const previewChapter = hoveredChapter ?? activeChapter;
  const previewLabel = previewChapter
    ? previewChapter.kind === "music" && previewChapter.artist
      ? `${previewChapter.artist} — ${previewChapter.title}`
      : previewChapter.title
    : null;
  const previewStamp = hoveredTime !== null ? formatTrackTime(hoveredTime) : previewChapter ? formatTrackTime(previewChapter.start) : null;

  return <div className={styles.controls}>
    <div className={styles.controlButtons}>
      <div className={styles.transport}>
        <button type="button" className={styles.skip} disabled={!selected || !player.active} onClick={() => skip(-15)} aria-label={t("episodes.rewind")} title={t("episodes.rewind")}>
          <SkipIcon />
        </button>
        <button type="button" className={styles.primary} onClick={() => playing ? player.pause() : void player.play(episode)} aria-label={playing ? t("episodes.pause") : t("common.play")}>
          {buffering ? <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" opacity=".25" /><path d="M12 3a9 9 0 0 1 9 9" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m7 4 13 8-13 8z" />}</svg>}
          <span className={styles.primaryLabel}>{buffering ? t("common.loading") : playing ? t("episodes.pause") : t("common.play")}</span>
        </button>
        <button type="button" className={styles.skip} disabled={!selected || !player.active} onClick={() => skip(15)} aria-label={t("episodes.forward")} title={t("episodes.forward")}>
          <SkipIcon forward />
        </button>
      </div>
      <span className={styles.playbackStatus} role="status">{buffering ? t("episodes.buffering") : ""}</span>
      {!compact ? <EpisodeVolumeControls /> : null}
    </div>
    <div className="trackProgress">
      <div
        className={styles.seekControl}
        onPointerMove={hasChapters ? (event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const usableWidth = Math.max(1, rect.width - 14);
          const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left - 7) / usableWidth));
          setHoveredTime(ratio * episode.duration);
        } : undefined}
        onPointerLeave={hasChapters ? () => setHoveredTime(null) : undefined}
      >
        <div
          className={`trackProgressBar${hasChapters ? ` ${styles.trackBarBehind}` : ""}`}
          aria-hidden="true"
          style={{ "--track-progress": `${Math.min(100, Math.max(0, position / episode.duration * 100))}%` } as CSSProperties}
        />
        {hasChapters ? (
          <div className={styles.chapterTrack} aria-hidden="true">
            {chapters.map((chapter) => {
              const span = chapter.end - chapter.start;
              const segProgress = span > 0 ? Math.min(100, Math.max(0, ((position - chapter.start) / span) * 100)) : 0;
              const isMusic = chapter.kind === "music";
              const isHovered = hoveredChapter?.id === chapter.id;
              const isCurrent = activeChapter?.id === chapter.id;
              return (
                <span
                  key={chapter.id}
                  className={[
                    styles.chapterSegment,
                    isMusic ? styles.chapterSegMusic : styles.chapterSegHost,
                    isHovered ? styles.chapterSegHovered : "",
                    isCurrent ? styles.chapterSegCurrent : "",
                  ].filter(Boolean).join(" ")}
                  style={{
                    left: `${(chapter.start / episode.duration) * 100}%`,
                    width: `${(span / episode.duration) * 100}%`,
                    "--seg-progress": `${segProgress}%`,
                  } as CSSProperties}
                >
                  <span className={styles.chapterSegBar} />
                </span>
              );
            })}
          </div>
        ) : null}
        <input className={styles.scrubber} type="range" min={0} max={episode.duration} step={0.1} value={position} aria-label={t("episodes.seek")} aria-valuetext={`${elapsed} / ${duration}`} onChange={(event) => {
          const value = Number(event.target.value);
          if (selected && player.active) player.seek(value);
          else { void player.play(episode, value); }
        }} />
      </div>
      <div className="trackProgressTimes" aria-hidden="true"><span>{elapsed}</span><span>{duration}</span></div>
    </div>
    {hasChapters ? (
      <div className={styles.timelineFooter}>
        <div className={styles.timelineLegend}>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatchHost} aria-hidden="true" />
            <span>{t("episodes.segmentHost")}</span>
          </span>
          <span className={styles.legendItem}>
            <span className={styles.legendSwatchMusic} aria-hidden="true" />
            <span>{t("episodes.segmentMusic")}</span>
          </span>
        </div>
        {previewLabel && previewStamp ? (
          <div className={styles.timelinePreview} title={previewLabel}>
            <span className={styles.timelinePreviewTime}>{previewStamp}</span>
            <span aria-hidden="true">·</span>
            <span className={styles.timelinePreviewTitle}>{previewLabel}</span>
          </div>
        ) : null}
      </div>
    ) : null}
    {selected && player.error ? <p role="alert">{player.error}</p> : null}
  </div>;
}


function SkipIcon({ forward = false }: { forward?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g transform={forward ? "translate(24 0) scale(-1 1)" : undefined}><path d="M4 8a9 9 0 1 1-1 8M4 3v5h5" /></g>
    <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="9" fontWeight="700">15</text>
  </svg>;
}

function EpisodeVolumeControls() {
  const { volume, setVolume } = useAudioPlayer();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const sliderId = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const slider = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!open) return;
    slider.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const blur = (event: FocusEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    document.addEventListener("focusin", blur);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      document.removeEventListener("focusin", blur);
    };
  }, [open]);
  return <>
    <div className={styles.volume}>
      <VolumeIcon muted={volume === 0} />
      <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label={t("player.volume")} />
    </div>
    <div className={styles.mobileVolume} ref={wrapper}>
      <button type="button" className={styles.volumeTrigger} ref={trigger} aria-label={t("player.volume")} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((value) => !value)}>
        <VolumeIcon muted={volume === 0} />
      </button>
      {open ? <div id={panelId} className={styles.volumePopover} role="group" aria-label={t("player.volume")}>
        <label htmlFor={sliderId}>{t("player.volume")} <output>{Math.round(volume * 100)}%</output></label>
        <input ref={slider} id={sliderId} aria-label={t("player.volume")} type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} />
      </div> : null}
    </div>
  </>;
}

function VolumeIcon({ muted }: { muted: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 5 6 9H3v6h3l5 4V5Z" />
    {muted ? <path d="m16 9 6 6m0-6-6 6" /> : <path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
  </svg>;
}
