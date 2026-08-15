"use client";

import { useMemo, type CSSProperties } from "react";
import { HeartIcon } from "@/components/HeartIcon";
import { getFavoriteTitle } from "@/lib/favorites";
import { useI18n } from "@/lib/i18n";
import { STATIONS } from "@/lib/stations";
import type { FavoriteTrack } from "@/types/radio";

interface FavoritesModalProps {
  favorites: FavoriteTrack[];
  syncError?: string;
  onRemove: (favorite: FavoriteTrack) => void;
  onDismiss: () => void;
}

export function FavoritesModal({ favorites, syncError, onRemove, onDismiss }: FavoritesModalProps) {
  const { locale, t } = useI18n();

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
        className="requestModal favoritesModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="favorites-title"
        tabIndex={-1}
      >
        <div className="requestModalHero">
          <div>
            <span className="requestModalKicker">{t("favorites.kicker")}</span>
            <h2 id="favorites-title">{t("favorites.title")}</h2>
            <p>{t("favorites.description")}</p>
          </div>
          <button
            className="requestModalClose"
            type="button"
            onClick={onDismiss}
            aria-label={t("favorites.close")}
            data-modal-autofocus
          >
            ×
          </button>
        </div>

        <div className="requestListShell favoritesListShell">
          {syncError ? <p className="favoritesSyncNotice" role="status">{syncError}</p> : null}
          {favorites.length === 0 ? (
            <FavoriteMessage title={t("favorites.empty")} />
          ) : (
            <div className="favoritesStationGroups">
              {STATIONS.map((station) => {
                const stationFavorites = favorites.filter((favorite) => favorite.stationId === station.id);

                return (
                  <details
                    className="favoritesStationGroup"
                    key={station.id}
                    style={{ "--station-accent": station.accentColor } as CSSProperties}
                    open
                  >
                    <summary className="favoritesStationHeading">
                      <span className="favoritesStationHeadingName" role="heading" aria-level={3}>{station.name}</span>
                      <span className="favoritesStationCount">{t("favorites.count", { count: stationFavorites.length })}</span>
                      <span className="favoritesStationChevron" aria-hidden="true" />
                    </summary>
                    {stationFavorites.length > 0 ? (
                      <ul className="requestSongList favoritesList">
                        {stationFavorites.map((favorite) => (
                          <li key={favorite.id}>
                            <FavoriteTrackItem
                              favorite={favorite}
                              locale={locale}
                              timeZone={station.timeZone}
                              onRemove={() => onRemove(favorite)}
                            />
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="favoritesStationEmpty">{t("favorites.stationEmpty")}</p>
                    )}
                  </details>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function FavoriteTrackItem({
  favorite,
  locale,
  timeZone,
  onRemove
}: {
  favorite: FavoriteTrack;
  locale: string;
  timeZone: string;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const title = getFavoriteTitle(favorite, t("track.unavailable"));
  const subtitle = [favorite.artist, favorite.album].filter(Boolean).join(" · ");
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      }),
    [locale, timeZone]
  );
  const likedAt = new Date(favorite.likedAt);
  const likedAtText = Number.isFinite(likedAt.getTime()) ? formatter.format(likedAt) : t("favorites.timeUnknown");

  return (
    <article className="requestSongItem favoriteSongItem">
      <div className="requestSongArt" aria-hidden="true">
        {favorite.art ? <img src={favorite.art} alt="" loading="lazy" /> : <span>{getInitial(title)}</span>}
      </div>
      <div className="requestSongText">
        <strong>{title}</strong>
        {subtitle ? <span>{subtitle}</span> : null}
        <time dateTime={Number.isFinite(likedAt.getTime()) ? likedAt.toISOString() : undefined}>
          {t("favorites.likedAt", { time: likedAtText })}
        </time>
      </div>
      <button
        className="favoriteRemoveButton"
        type="button"
        onClick={onRemove}
        aria-label={t("favorites.remove", { title })}
        title={t("favorites.remove", { title })}
      >
        <HeartIcon filled />
      </button>
    </article>
  );
}

function FavoriteMessage({ title }: { title: string }) {
  return (
    <div className="requestMessage requestMessage-empty" role="status">
      <span className="requestMessageIcon" aria-hidden="true">♡</span>
      <p>{title}</p>
    </div>
  );
}

function getInitial(value: string): string {
  return value.trim().charAt(0).toUpperCase() || "?";
}
