"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import styles from "./Episodes.module.css";

function RssIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PodcastRssActions({ rssUrl, stationName }: { rssUrl?: string; stationName: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [rssUrl]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (!rssUrl) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(rssUrl);
      setCopied(true);
    } catch {
      const input = document.createElement("textarea");
      input.value = rssUrl;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      if (ok) setCopied(true);
    }
  };

  return (
    <div className={styles.rssActions}>
      <button
        type="button"
        className={styles.rssCopyButton}
        onClick={() => void copy()}
        aria-label={t("podcasts.copyRssAria", { station: stationName })}
        title={rssUrl}
      >
        <RssIcon />
        <span>{copied ? t("podcasts.rssCopied") : t("podcasts.copyRss")}</span>
      </button>
      <a
        href={rssUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.rssFeedLink}
        aria-label={t("podcasts.openRss", { station: stationName })}
        title={rssUrl}
      >
        RSS ↗
      </a>
    </div>
  );
}
