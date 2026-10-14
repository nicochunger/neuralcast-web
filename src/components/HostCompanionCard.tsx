"use client";

import { useEffect, useState } from "react";
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

export function HostCompanionCard({ stationId, channelId }: { stationId: string; channelId: string }) {
  const { locale, t } = useI18n();
  const [card, setCard] = useState<HostCompanion | null>(null);
  const [pinned, setPinned] = useState<HostCompanion | null>(null);
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (pending) return;
      pending = true;
      try {
        const response = await fetch(`/api/host-companion/${encodeURIComponent(stationId)}?channel=${encodeURIComponent(channelId)}`, {
          cache: "no-store", signal: controller.signal
        });
        if (!response.ok) throw new Error("Companion unavailable");
        const payload = await response.json() as { card: HostCompanion | null };
        if (!controller.signal.aborted) setCard(payload.card?.channel === channelId ? payload.card : null);
      } catch {
        if (!controller.signal.aborted) setCard(null);
      } finally { pending = false; }
    }
    void refresh();
    const polling = window.setInterval(() => void refresh(), 15_000);
    const ticking = window.setInterval(() => setNow(Date.now() / 1000), 1_000);
    return () => { controller.abort(); window.clearInterval(polling); window.clearInterval(ticking); };
  }, [stationId, channelId]);

  const active = pinned ?? (card && card.expected_start <= now && card.expires_at > now ? card : null);
  if (!active || active.channel !== channelId) return null;
  const labels = {
    news: t("companion.news"), concert_check: t("companion.concert"),
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
      <button className={styles.transcriptButton} type="button" aria-expanded={Boolean(pinned)} onClick={() => setPinned(pinned ? null : active)}>{pinned ? t("companion.hideTranscript") : t("companion.readTranscript")}</button>
      {pinned ? <div className={styles.transcript}>{pinned.transcript}</div> : null}
    </aside>
  );
}
