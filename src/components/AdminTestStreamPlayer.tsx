"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

const STREAM_URL =
  "https://neuralcast.duckdns.org/listen/neuralcast_shared_media_test/radio.mp3";
const PUBLIC_PAGE_URL =
  "https://neuralcast.duckdns.org/public/neuralcast_shared_media_test";

type TestPlayerState = "idle" | "loading" | "playing" | "error";

export function AdminTestStreamPlayer() {
  const { t } = useI18n();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playerState, setPlayerState] = useState<TestPlayerState>("idle");

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  async function togglePlayback() {
    if (playerState === "playing" || playerState === "loading") {
      audioRef.current?.pause();
      setPlayerState("idle");
      return;
    }

    const audio = audioRef.current ?? new Audio(STREAM_URL);
    audio.preload = "none";
    audioRef.current = audio;
    audio.onplaying = () => setPlayerState("playing");
    audio.onerror = () => setPlayerState("error");
    audio.onended = () => setPlayerState("idle");
    setPlayerState("loading");

    try {
      await audio.play();
    } catch {
      setPlayerState("error");
    }
  }

  const isActive = playerState === "playing" || playerState === "loading";

  return (
    <section className="adminTestStream" aria-label={t("admin.englishTestStream")}>
      <div className="adminTestStreamCopy">
        <strong>{t("admin.englishTestStream")}</strong>
        <span>
          {playerState === "error"
            ? t("admin.testStreamError")
            : t("admin.englishTestStreamDescription")}
        </span>
      </div>
      <div className="adminTestStreamActions">
        <button
          className="adminTestStreamButton"
          type="button"
          onClick={() => void togglePlayback()}
          aria-pressed={isActive}
        >
          {isActive ? t("admin.stopEnglishTest") : t("admin.playEnglishTest")}
        </button>
        <a
          className="adminTestStreamLink"
          href={PUBLIC_PAGE_URL}
          target="_blank"
          rel="noreferrer"
        >
          {t("admin.openPublicPage")}
        </a>
      </div>
    </section>
  );
}
