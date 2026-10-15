"use client";
import type { PublishedEpisode } from "@/types/episode";
import { useEpisodePlayer } from "@/context/EpisodePlayerContext";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { useI18n } from "@/lib/i18n";
import { formatTrackTime } from "@/lib/trackProgress";
import styles from "./Episodes.module.css";

export function EpisodeControls({ episode, compact = false }: { episode: PublishedEpisode; compact?: boolean }) {
  const player = useEpisodePlayer();
  const { t } = useI18n();
  const { volume, setVolume, toggleMute } = useAudioPlayer();
  const selected = player.episode?.station === episode.station && player.episode.id === episode.id && player.episode.revision === episode.revision;
  const position = selected ? player.position : 0;
  const playing = selected && player.active && ["playing", "buffering"].includes(player.state);
  return <div className={styles.controls}>
    <div className={styles.controlButtons}>
      <button type="button" className={styles.primary} onClick={() => playing ? player.pause() : void player.play(episode)} aria-label={playing ? t("episodes.pause") : t("episodes.resume")}>
        <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span> {playing ? t("episodes.pause") : t("episodes.resume")}
      </button>
      {!compact ? <button type="button" onClick={() => { void player.play(episode, 0); }}>{t("episodes.restart")}</button> : null}
      <span className={styles.time}>{formatTrackTime(position)} / {formatTrackTime(episode.duration)}</span>
    </div>
    <input className={styles.scrubber} type="range" min={0} max={episode.duration} step={0.1} value={position} aria-label={t("episodes.seek")} aria-valuetext={`${formatTrackTime(position)} / ${formatTrackTime(episode.duration)}`} onChange={(event) => {
      const value = Number(event.target.value);
      if (selected && player.active) player.seek(value);
      else { void player.play(episode, value); }
    }} />
    {!compact ? <div className={styles.volume}><button type="button" onClick={toggleMute}>{t(volume === 0 ? "player.unmute" : "player.mute")}</button><input type="range" min={0} max={1} step={0.01} value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label={t("player.volume")} /></div> : null}
    {selected && player.error ? <p role="alert">{player.error}</p> : null}
  </div>;
}
