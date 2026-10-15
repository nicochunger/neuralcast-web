"use client";

import { useState } from "react";
import { EpisodeGuide } from "@/components/EpisodeGuide";
import { useI18n } from "@/lib/i18n";
import type { HostCompanion } from "@/types/hostCompanion";
import styles from "./HostCompanionCard.module.css";

function safeLink(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username ? url.href : undefined;
  } catch { return undefined; }
}

function concertDate(value: string | undefined, locale: string): string | undefined {
  if (!value) return undefined;
  // Calendar dates must not shift a day in the listener's timezone.
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, {
    day: "numeric", month: "long", year: "numeric", timeZone: "UTC"
  }).format(date);
}

export function HostCompanionCard({ card: active, currentTime, fallbackArtwork }: { card: HostCompanion; currentTime: number; fallbackArtwork: string }) {
  const { locale, t } = useI18n();
  const [showTranscript, setShowTranscript] = useState(false);
  const now = currentTime / 1000;

  const labels = {
    episode: t("companion.episode"), news: t("companion.news"), concert_check: t("companion.concert"),
    short_story: t("companion.story"), album_spotlight: t("companion.album"),
    era_snapshot: t("companion.era"), deep_dive: t("companion.deepDive")
  };
  const minutes = Math.max(0, Math.floor((now - active.expected_start) / 60));
  const age = new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-minutes, "minute");

  return (
    <aside className={styles.card} aria-label={t("companion.label")}>
      <div className={styles.topline}><span>{labels[active.archetype]}</span><time dateTime={new Date(active.expected_start * 1000).toISOString()}>{age}</time></div>
      <h2>{active.content.title}</h2>
      {active.content.subject ? <p className={styles.subject}>{active.content.subject.artist} · {active.content.subject.album || active.content.subject.title}{active.content.subject.year ? ` · ${active.content.subject.year}` : ""}</p> : null}
      {active.content.summary ? <p className={styles.summary}>{active.content.summary}</p> : null}
      {active.episode ? <EpisodeGuide card={active} currentTime={currentTime} fallbackArtwork={fallbackArtwork} /> : null}
      {active.content.key_points.length ? <ul className={styles.points}>{active.content.key_points.map((point, index) => <li key={index}>{point}</li>)}</ul> : null}
      {active.content.items.length ? <ul className={styles.items}>{active.content.items.map((item, index) => {
        const link = safeLink(item.source_url);
        return <li key={index}>
          <strong>{item.headline || item.artist}</strong>
          {item.event_date ? <time dateTime={item.event_date}>{concertDate(item.event_date, locale)}</time> : null}
          {item.venue || item.city ? <span>{[item.venue, item.city, item.country].filter(Boolean).join(" · ")}</span> : null}
          {link ? <a href={link} target="_blank" rel="noopener noreferrer">{active.archetype === "concert_check" ? t("companion.eventLink") : t("companion.source")} <span aria-hidden="true">↗</span></a> : null}
        </li>;
      })}</ul> : null}
      <button className={styles.transcriptButton} type="button" aria-expanded={showTranscript} onClick={() => setShowTranscript((open) => !open)}>{showTranscript ? t("companion.hideTranscript") : t("companion.readTranscript")}</button>
      {showTranscript ? <div className={styles.transcript}>{active.transcript}</div> : null}
    </aside>
  );
}
