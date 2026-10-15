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
  const elapsed = formatTrackTime(position);
  const duration = formatTrackTime(episode.duration);

  return <div className={styles.controls}>
    <div className={styles.controlButtons}>
      <button type="button" className={styles.primary} onClick={() => playing ? player.pause() : void player.play(episode)} aria-label={playing ? t("episodes.pause") : t("common.play")}>
        <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span> {playing ? t("episodes.pause") : t("common.play")}
      </button>
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
