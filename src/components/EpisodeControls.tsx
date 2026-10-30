"use client";
import type { CSSProperties } from "react";
import type { PublishedEpisode } from "@/types/episode";
import { useEpisodePlayer } from "@/context/EpisodePlayerContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useI18n } from "@/lib/i18n";
import { formatTrackTime } from "@/lib/trackProgress";
import styles from "./Episodes.module.css";

export function EpisodeControls({ episode, compact = false }: { episode: PublishedEpisode; compact?: boolean }) {
  const player = useEpisodePlayer();
  const { t } = useI18n();
  const { volume, setVolume } = useAudioPlayer();
  const selected = player.episode?.station === episode.station && player.episode.id === episode.id && player.episode.revision === episode.revision;
  const position = selected ? player.position : 0;
  const playing = selected && player.active && ["playing", "buffering"].includes(player.state);
  const buffering = selected && player.active && player.state === "buffering";
  const skip = (seconds: number) => player.seek(Math.min(episode.duration, Math.max(0, position + seconds)));
  const elapsed = formatTrackTime(position);
  const duration = formatTrackTime(episode.duration);

  return <div className={styles.controls}>
    <div className={styles.controlButtons}>
      <div className={styles.transport}>
        <button type="button" className={styles.skip} disabled={!selected || !player.active} onClick={() => skip(-15)} aria-label={t("episodes.rewind")} title={t("episodes.rewind")}>
          <SkipIcon />
        </button>
        <button type="button" className={styles.primary} onClick={() => playing ? player.pause() : void player.play(episode)} aria-label={playing ? t("episodes.pause") : t("common.play")}>
          {buffering ? <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9" opacity=".25" /><path d="M12 3a9 9 0 0 1 9 9" /></svg> : <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{playing ? <path d="M6 4h4v16H6zm8 0h4v16h-4z" /> : <path d="m7 4 13 8-13 8z" />}</svg>}
          {buffering ? t("common.loading") : playing ? t("episodes.pause") : t("common.play")}
        </button>
        <button type="button" className={styles.skip} disabled={!selected || !player.active} onClick={() => skip(15)} aria-label={t("episodes.forward")} title={t("episodes.forward")}>
          <SkipIcon forward />
        </button>
      </div>
      <span className={styles.playbackStatus} role="status">{buffering ? t("episodes.buffering") : ""}</span>
      {!compact ? <div className={styles.volume}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></svg>
        <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label={t("player.volume")} />
      </div> : null}
    </div>
    <div className="trackProgress">
      <div className={styles.seekControl}>
        <div className="trackProgressBar" aria-hidden="true" style={{ "--track-progress": `${Math.min(100, Math.max(0, position / episode.duration * 100))}%` } as CSSProperties} />
        <input className={styles.scrubber} type="range" min={0} max={episode.duration} step={0.1} value={position} aria-label={t("episodes.seek")} aria-valuetext={`${elapsed} / ${duration}`} onChange={(event) => {
          const value = Number(event.target.value);
          if (selected && player.active) player.seek(value);
          else { void player.play(episode, value); }
        }} />
      </div>
      <div className="trackProgressTimes" aria-hidden="true"><span>{elapsed}</span><span>{duration}</span></div>
    </div>
    {selected && player.error ? <p role="alert">{player.error}</p> : null}
  </div>;
}


function SkipIcon({ forward = false }: { forward?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <g transform={forward ? "translate(24 0) scale(-1 1)" : undefined}><path d="M4 8a9 9 0 1 1-1 8M4 3v5h5" /></g>
    <text x="12" y="16" textAnchor="middle" fill="currentColor" stroke="none" fontSize="9" fontWeight="700">15</text>
  </svg>;
}
