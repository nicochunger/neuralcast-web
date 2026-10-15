"use client";

import type { CSSProperties } from "react";
import { useI18n } from "@/lib/i18n";
import { HostCompanionCard } from "@/components/HostCompanionCard";
import type { HostCompanion } from "@/types/hostCompanion";
import type { Station } from "@/types/radio";
import styles from "./HostCompanionCard.module.css";

export function HostCompanionModal({ station, card, currentTime, onDismiss }: {
  station: Station; card: HostCompanion; currentTime: number; onDismiss: () => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`requestModalBackdrop ${styles.backdrop}`} role="presentation" onClick={(event) => {
      if (event.target === event.currentTarget) onDismiss();
    }}>
      <section className={`requestModal ${styles.modal}`} role="dialog" aria-modal="true" aria-labelledby="host-recap-title" tabIndex={-1} style={{
        "--station-accent": station.accentColor, "--station-bg": `url(${station.backgroundImage})`
      } as CSSProperties}>
        <div className="requestModalHero">
          <div><span className="requestModalKicker">{station.name}</span><h2 id="host-recap-title">{t("companion.button")}</h2></div>
          <button className="requestModalClose" type="button" onClick={onDismiss} aria-label={t("companion.close")} data-modal-autofocus>×</button>
        </div>
        <HostCompanionCard card={card} currentTime={currentTime} fallbackArtwork={station.artworkImage} />
      </section>
    </div>
  );
}
