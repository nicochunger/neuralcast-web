"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import type { RequestableSong, SongRequestState, Station } from "@/types/radio";

interface SongRequestModalProps {
  station: Station;
  requestState: SongRequestState;
  onRequestSong: (song: RequestableSong) => void;
  onDismiss: () => void;
}

export function SongRequestModal({ station, requestState, onRequestSong, onDismiss }: SongRequestModalProps) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredSongs = useMemo(() => {
    if (!normalizedQuery) {
      return requestState.songs;
    }

    return requestState.songs.filter((song) =>
      [song.displayText, song.album, song.genre].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery)
    );
  }, [normalizedQuery, requestState.songs]);

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
        className="requestModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="request-modal-title"
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
            <h2 id="request-modal-title">{t("request.title")}</h2>
            <p>{t("request.description")}</p>
          </div>
          <button className="requestModalClose" type="button" onClick={onDismiss} aria-label={t("request.close")}>
            ×
          </button>
        </div>

        <label className="requestSearch">
          <span>{t("request.searchLabel")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("request.searchPlaceholder")}
            autoFocus
          />
        </label>

        <div className="requestListShell">
          {requestState.isLoading ? (
            <RequestMessage title={t("request.loading")} />
          ) : requestState.error ? (
            <RequestMessage title={requestState.error} />
          ) : requestState.songs.length === 0 ? (
            <RequestMessage title={t("request.empty")} />
          ) : filteredSongs.length === 0 ? (
            <RequestMessage title={t("request.noMatches")} />
          ) : (
            <ul className="requestSongList">
              {filteredSongs.map((song) => (
                <li key={song.requestId}>
                  <SongRequestItem
                    song={song}
                    isSubmitting={requestState.submittingRequestId === song.requestId}
                    isDisabled={requestState.submittingRequestId !== undefined}
                    onRequestSong={onRequestSong}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

function SongRequestItem({
  song,
  isSubmitting,
  isDisabled,
  onRequestSong
}: {
  song: RequestableSong;
  isSubmitting: boolean;
  isDisabled: boolean;
  onRequestSong: (song: RequestableSong) => void;
}) {
  const { t } = useI18n();
  const title = song.title ?? song.text ?? song.displayText;
  const subtitle = [song.artist, song.album].filter(Boolean).join(" · ");

  return (
    <article className="requestSongItem">
      <div className="requestSongArt" aria-hidden="true">
        {song.art ? <img src={song.art} alt="" loading="lazy" /> : <span>{getInitial(title)}</span>}
      </div>
      <div className="requestSongText">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        {song.genre ? <em>{song.genre}</em> : null}
      </div>
      <button
        className="requestSongButton"
        type="button"
        onClick={() => onRequestSong(song)}
        disabled={isDisabled}
      >
        {isSubmitting ? t("request.submitting") : t("request.submit")}
      </button>
    </article>
  );
}

function RequestMessage({ title }: { title: string }) {
  return (
    <div className="requestMessage">
      <span aria-hidden="true" />
      <p>{title}</p>
    </div>
  );
}

function getInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || "?";
}
