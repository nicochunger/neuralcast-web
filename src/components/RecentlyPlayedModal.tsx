"use client";

import { useMemo, type CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import type { PlayedTrack, Station, StationNowPlayingState } from "@/types/radio";

interface RecentlyPlayedModalProps {
  station: Station;
  nowPlaying: StationNowPlayingState;
  onDismiss: () => void;
}

export function RecentlyPlayedModal({ station, nowPlaying, onDismiss }: RecentlyPlayedModalProps) {
  const { locale, t } = useI18n();
  const history = nowPlaying.history ?? [];
  const hasLoadedHistory = nowPlaying.history !== undefined;
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: station.timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }),
    [locale, station.timeZone]
  );

  return (
    <div
      className="requestModalBackdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <section
        className="requestModal historyModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recently-played-title"
        tabIndex={-1}
        style={
          {
            "--station-accent": station.accentColor,
            "--station-bg": `url(${station.backgroundImage})`
          } as CSSProperties
        }
      >
        <div className="requestModalHero">
          <div>
            <span className="requestModalKicker">{station.name}</span>
            <h2 id="recently-played-title">{t("history.title")}</h2>
            <p>{t("history.description", { station: station.name })}</p>
          </div>
          <button
            className="requestModalClose"
            type="button"
            onClick={onDismiss}
            aria-label={t("history.close")}
            data-modal-autofocus
          >
            ×
          </button>
        </div>

        <div className="requestListShell historyListShell">
          {!hasLoadedHistory && nowPlaying.isLoading ? (
            <HistoryMessage title={`${t("common.loading")}...`} variant="loading" />
          ) : nowPlaying.error && history.length === 0 ? (
            <HistoryMessage title={t("history.unavailable")} variant="error" />
          ) : history.length === 0 ? (
            <HistoryMessage title={t("history.empty")} variant="empty" />
          ) : (
            <ul className="requestSongList historyList">
              {history.map((track) => (
                <li key={track.id}>
                  <HistoryTrackItem track={track} formatter={formatter} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function HistoryTrackItem({
  track,
  formatter
}: {
  track: PlayedTrack;
  formatter: Intl.DateTimeFormat;
}) {
  const { t } = useI18n();
  const title = track.title ?? track.text ?? track.artist ?? t("track.unavailable");
  const subtitle = [track.artist, track.album].filter(Boolean).join(" · ");
  const playedAt = track.playedAt === undefined ? undefined : new Date(track.playedAt * 1000);

  return (
    <article className="requestSongItem historySongItem">
      <div className="requestSongArt" aria-hidden="true">
        {track.art ? <img src={track.art} alt="" loading="lazy" /> : <span>{getInitial(title)}</span>}
      </div>
      <div className="requestSongText">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
      </div>
      <time className="historySongTime" dateTime={playedAt?.toISOString()}>
        {t("history.playedAt", {
          time: playedAt && Number.isFinite(playedAt.getTime()) ? formatter.format(playedAt) : t("history.timeUnknown")
        })}
      </time>
    </article>
  );
}

function HistoryMessage({ title, variant }: { title: string; variant: "loading" | "error" | "empty" }) {
  return (
    <div className={`requestMessage requestMessage-${variant}`} role={variant === "error" ? "alert" : "status"}>
      <span className="requestMessageIcon" aria-hidden="true">
        {variant === "error" ? "!" : variant === "empty" ? "♪" : null}
      </span>
      <p>{title}</p>
    </div>
  );
}

function getInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || "?";
}
