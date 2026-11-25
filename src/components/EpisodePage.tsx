"use client";
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { EpisodeControls } from "@/components/EpisodeControls";
import { EpisodeGuide } from "@/components/EpisodeGuide";
import { PodcastRssActions } from "@/components/PodcastRssActions";
import { useEpisodePlayer } from "@/context/EpisodePlayerContext";
import { formatEpisodeTitle } from "@/lib/episodes";
import { useI18n } from "@/lib/i18n";
import { STATIONS } from "@/lib/stations";
import { formatTrackTime } from "@/lib/trackProgress";
import type { PublishedEpisode } from "@/types/episode";
import type { HostCompanion } from "@/types/hostCompanion";
import styles from "./Episodes.module.css";

export function EpisodePage({ episode, rssUrl }: { episode: PublishedEpisode; rssUrl?: string }) {
  const { t, locale } = useI18n();
  const player = useEpisodePlayer();
  const [showTranscript, setShowTranscript] = useState(false);
  const [artFailed, setArtFailed] = useState(false);
  const station = STATIONS.find((item) => item.id === episode.station)!;
  const stationThemeClass = episode.station === "neuralforge" ? styles.themeForge : styles.themeCast;
  const selected =
    player.episode?.id === episode.id &&
    player.episode.station === episode.station &&
    player.episode.revision === episode.revision;
  const position = selected ? player.position : 0;
  const displayTitle = formatEpisodeTitle(episode);
  const chapters = episode.chapters ?? [];

  const activeChapter = chapters.find((chapter) => position >= chapter.start && position < chapter.end);
  const liveArtwork =
    !artFailed && activeChapter?.kind === "music" && activeChapter.art_url
      ? activeChapter.art_url
      : station.podcastArtworkImage;

  const card: HostCompanion = {
    id: episode.id,
    channel: episode.channel,
    archetype: "episode",
    expected_start: 0,
    expected_end: episode.duration,
    expires_at: 0,
    transcript: episode.transcript ?? "",
    content: { title: displayTitle, summary: episode.description, key_points: [], items: [] },
    episode: { media_id: episode.id, duration: episode.duration, chapters }
  };

  const seek = (seconds: number) => {
    if (selected && player.active) player.seek(seconds);
    else {
      void player.play(episode, seconds);
    }
  };

  const languageName = new Intl.DisplayNames([locale], { type: "language" }).of(episode.language.split("-")[0]);
  const publishedDate = new Date(episode.published_at).toLocaleDateString(locale, {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  const guide = (
    <EpisodeGuide
      card={card}
      position={position}
      fallbackArtwork={station.podcastArtworkImage}
      onSeek={seek}
    />
  );

  return (
    <div className="appShell">
      <SiteHeader podcastStation={episode.station} />
      <main
        className={`${styles.page} ${stationThemeClass}`}
        style={{ "--station-accent": station.accentColor } as CSSProperties}
      >
        <div className={styles.episodeTopBar}>
          <Link className={styles.back} href={`/episodes?station=${episode.station}`}>
            ← {t("episodes.back")}
          </Link>
          <PodcastRssActions rssUrl={rssUrl} stationName={station.name} />
        </div>

        {/* Full-Width Broadcast Episode Deck */}
        <section className={styles.playerCard} aria-labelledby="episode-title">
          <div className={styles.playerDeckGrid}>
            <div className={styles.playerArtworkBay}>
              <div className={styles.playerArtworkFrame}>
                <img
                  src={liveArtwork}
                  alt=""
                  width={220}
                  height={220}
                  onError={() => setArtFailed(true)}
                />
              </div>
              {activeChapter ? (
                <div className={styles.liveChapterCaption}>
                  <span>{t("episodes.currentChapter")}</span>
                  <strong>{activeChapter.title}</strong>
                </div>
              ) : null}
            </div>

            <div className={styles.playerMainBay}>
              <div className={styles.playerMetaLine}>
                <strong>{station.name}</strong>
                <span aria-hidden="true">·</span>
                <time dateTime={episode.published_at}>{publishedDate}</time>
                <span aria-hidden="true">·</span>
                <span>{formatTrackTime(episode.duration)}</span>
                {languageName ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{languageName}</span>
                  </>
                ) : null}
              </div>

              <h1 id="episode-title" className={styles.episodeHeading}>
                {displayTitle}
              </h1>

              <p className={styles.playerDescription}>{episode.description}</p>

              <EpisodeControls episode={episode} />
            </div>
          </div>
        </section>

        {/* Below-Deck Editorial Listening Room: Wide Chapter Timeline + Sticky Transcript */}
        <div className={styles.listeningRoomGrid}>
          <aside className={styles.guideColumn} aria-label={t("episodes.guide")}>
            <div className={styles.sectionHeader}>
              <h2>{t("episodes.guide")}</h2>
              <span className={styles.sectionMeta}>
                {chapters.length > 0 ? `${chapters.length}` : ""}
              </span>
            </div>
            {guide}
          </aside>

          <section className={styles.transcriptSection} aria-labelledby="transcript-title">
            <div className={styles.transcriptHeader}>
              <h2 id="transcript-title">{t("episodes.transcript")}</h2>
              <button
                className={styles.transcriptToggle}
                type="button"
                aria-expanded={showTranscript}
                aria-controls="episode-transcript"
                onClick={() => setShowTranscript((value) => !value)}
              >
                {t(showTranscript ? "companion.hideTranscript" : "companion.readTranscript")}
              </button>
            </div>
            <div id="episode-transcript" className={styles.transcript} hidden={!showTranscript}>
              {episode.transcript
                ?.split(/\r?\n+/)
                .filter((paragraph) => paragraph.trim())
                .map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
