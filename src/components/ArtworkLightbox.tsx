"use client";

import { useI18n } from "@/lib/i18n";

export interface ArtworkLightboxData {
  imageUrl: string;
  title: string;
  artist?: string;
  album?: string;
}

interface ArtworkLightboxProps extends ArtworkLightboxData {
  onDismiss: () => void;
}

export function ArtworkLightbox({ imageUrl, title, artist, album, onDismiss }: ArtworkLightboxProps) {
  const { t } = useI18n();
  const subtitle = [artist, album].filter(Boolean).join(" · ");

  return (
    <div
      className="artworkLightboxBackdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onDismiss();
        }
      }}
    >
      <section
        className="artworkLightbox"
        role="dialog"
        aria-modal="true"
        aria-labelledby="artwork-lightbox-title"
        tabIndex={-1}
      >
        <button
          className="artworkLightboxClose"
          type="button"
          onClick={onDismiss}
          aria-label={t("artwork.close")}
          data-modal-autofocus
        >
          ×
        </button>
        <img
          className="artworkLightboxImage"
          src={imageUrl}
          alt={[title, artist].filter(Boolean).join(" — ")}
        />
        <div className="artworkLightboxCaption">
          <h2 id="artwork-lightbox-title">{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </section>
    </div>
  );
}
