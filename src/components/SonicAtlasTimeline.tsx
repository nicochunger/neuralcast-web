"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import type { AtlasDecadeBucket } from "@/types/atlas";
import styles from "./SonicAtlas.module.css";

interface SonicAtlasTimelineProps {
  decades: AtlasDecadeBucket[];
  selectedDecades: number[];
  onToggleDecade: (decade: number) => void;
  onClearDecades: () => void;
  onSelectPlaylist: (slug: string) => void;
}

export function SonicAtlasTimeline({
  decades,
  selectedDecades,
  onToggleDecade,
  onClearDecades,
  onSelectPlaylist,
}: SonicAtlasTimelineProps) {
  const { t } = useI18n();
  const [hoveredDecade, setHoveredDecade] = useState<number | null>(null);

  const maxCount = useMemo(
    () => Math.max(1, ...decades.map((bucket) => bucket.unique_track_count)),
    [decades]
  );

  const previewBucket = useMemo(() => {
    if (hoveredDecade !== null) {
      return decades.find((b) => b.decade === hoveredDecade) ?? null;
    }
    if (selectedDecades.length === 1) {
      return decades.find((b) => b.decade === selectedDecades[0]) ?? null;
    }
    return null;
  }, [decades, hoveredDecade, selectedDecades]);

  if (decades.length === 0) {
    return null;
  }

  const activeDecadeLabels = selectedDecades
    .slice()
    .sort((a, b) => a - b)
    .map((d) => `${d}s`)
    .join(", ");

  return (
    <section className={styles.timelineSection} aria-labelledby="atlas-timeline-heading">
      <div className={styles.timelineHeader}>
        <div className={styles.sectionHeadingGroup}>
          <h2 id="atlas-timeline-heading" className={styles.sectionTitle}>
            {t("atlas.timeline.title")}
          </h2>
          <p className={styles.sectionSubtitle}>{t("atlas.timeline.subtitle")}</p>
        </div>

        <div className={styles.timelineFilterRow}>
          {selectedDecades.length > 0 ? (
            <>
              <span className={styles.metaChip}>
                {t("atlas.timeline.activeFilter", { decades: activeDecadeLabels })}
              </span>
              <button type="button" className={styles.clearPill} onClick={onClearDecades}>
                {t("atlas.timeline.clearDecades")} ×
              </button>
            </>
          ) : (
            <span className={styles.metaChip}>{t("atlas.timeline.allEras")}</span>
          )}
        </div>
      </div>

      <div className={styles.histogramTrack} role="group" aria-label={t("atlas.timeline.title")}>
        {decades.map((bucket) => {
          const isSelected = selectedDecades.includes(bucket.decade);
          const isDimmed = selectedDecades.length > 0 && !isSelected;
          const heightPercent = Math.max(
            7,
            Math.round((bucket.unique_track_count / maxCount) * 100)
          );

          return (
            <button
              key={bucket.decade}
              type="button"
              className={`${styles.decadeColumn} ${
                isSelected ? styles.decadeColumnSelected : ""
              } ${isDimmed ? styles.decadeColumnDimmed : ""}`}
              aria-pressed={isSelected}
              aria-label={`${bucket.label} — ${t("atlas.timeline.tracksLabel", {
                count: bucket.unique_track_count,
              })}`}
              data-decade={bucket.decade}
              onClick={() => onToggleDecade(bucket.decade)}
              onMouseEnter={() => setHoveredDecade(bucket.decade)}
              onMouseLeave={() => setHoveredDecade((prev) => (prev === bucket.decade ? null : prev))}
              onFocus={() => setHoveredDecade(bucket.decade)}
              onBlur={() => setHoveredDecade((prev) => (prev === bucket.decade ? null : prev))}
            >
              <span className={styles.decadeCount}>{bucket.unique_track_count}</span>
              <span className={styles.decadeBarTrack} aria-hidden="true">
                <span
                  className={styles.decadeBarFill}
                  style={{ height: `${heightPercent}%` }}
                />
              </span>
              <span className={styles.decadeLabel}>{bucket.label}</span>
            </button>
          );
        })}
      </div>

      {previewBucket ? (
        <div className={styles.decadePreviewStrip} aria-live="polite">
          <div>
            <span className={styles.decadePreviewHighlight}>{previewBucket.label}</span>
            {" · "}
            {t("atlas.timeline.tracksLabel", { count: previewBucket.unique_track_count })}
          </div>
          {previewBucket.top_playlists.length > 0 ? (
            <div className={styles.decadePreviewPills}>
              {previewBucket.top_playlists.map((pl) => (
                <button
                  key={pl.slug}
                  type="button"
                  className={styles.pillButton}
                  onClick={() => onSelectPlaylist(pl.slug)}
                >
                  <span>{pl.name}</span>
                  <span className={styles.pillMetric}>{pl.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
