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
  const captionTitle = album ?? artist ?? title;
  const captionArtist = album && artist ? artist : undefined;

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
          alt={[artist, album].filter(Boolean).join(" — ") || title}
        />
        <div className="artworkLightboxCaption">
          <h2 id="artwork-lightbox-title" className="artworkLightboxAlbum">{captionTitle}</h2>
          {captionArtist ? <p className="artworkLightboxArtist">{captionArtist}</p> : null}
        </div>
      </section>
    </div>
  );
}
