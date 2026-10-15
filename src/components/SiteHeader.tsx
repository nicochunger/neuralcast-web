"use client";

import Link from "next/link";
import { FlagIcon } from "@/components/FlagIcon";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import type { StationId } from "@/types/radio";
import type { Locale } from "@/lib/locale";

export function SiteHeader({ extraActions, englishOnly = false, podcastStation }: { extraActions?: ReactNode; englishOnly?: boolean; podcastStation?: StationId }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const inPodcasts = pathname.startsWith("/episodes");
  const selectedPodcast = podcastStation ?? pathname.match(/^\/episodes\/(neuralcast|neuralforge)\//)?.[1];
  const podcastHref = selectedPodcast ? `/episodes?station=${selectedPodcast}` : "/episodes";
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  const languageOptions: Array<{ locale: Locale; label: string; shortLabel: string; country: "us" | "ar" | "ch" }> = [
    { locale: "en", label: "English", shortLabel: "EN", country: "us" },
    { locale: "es", label: "Español", shortLabel: "ES", country: "ar" },
    { locale: "fr", label: "Français", shortLabel: "FR", country: "ch" }
  ];
  const activeLanguage = languageOptions.find((option) => option.locale === locale) ?? languageOptions[0];

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!languageMenuRef.current?.contains(event.target as Node)) {
        setLanguageMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <header className="appHeader">
      <Link className="brandLockup" href="/" aria-label={(englishOnly ? "Back to radio" : t("nav.backToRadio"))}>
        <img src="/neuralcast-logo-160.webp" alt="" className="brandIcon" width="160" height="160" />
        <div>
          <h1>NeuralCast</h1>
          <p>{(englishOnly ? "AI-hosted radio and podcasts from Estavayer, Switzerland." : t("app.tagline"))}</p>
        </div>
      </Link>
      <div className="headerActions">
        <nav className="primaryNavigation" aria-label={(englishOnly ? "Primary navigation" : t("nav.label"))}>
          <Link className="headerContextLink" href={pathname === "/about" ? "/" : "/about"}>
            {pathname === "/about" ? (englishOnly ? "Back to radio" : t("nav.backToRadio")) : (englishOnly ? "About" : t("nav.about"))}
          </Link>
        </nav>
        <div className="headerUtilityRow">
          {!englishOnly ? <div className="languageMenu" ref={languageMenuRef}>
            <button
              className="languageMenuTrigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={languageMenuOpen}
              aria-label={t("common.language")}
              onClick={() => setLanguageMenuOpen((open) => !open)}
            >
              <FlagIcon country={activeLanguage.country} />
              <span>{activeLanguage.shortLabel}</span>
              <span className={`languageMenuChevron ${languageMenuOpen ? "languageMenuChevronOpen" : ""}`} aria-hidden="true">
                ▾
              </span>
            </button>
            {languageMenuOpen ? (
              <div className="languageMenuList" role="menu" aria-label={t("common.language")}>
                {languageOptions.map((option) => (
                  <button
                    key={option.locale}
                    className={`languageMenuItem ${option.locale === locale ? "languageMenuItemActive" : ""}`}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.locale === locale}
                    onClick={() => {
                      setLocale(option.locale);
                      setLanguageMenuOpen(false);
                    }}
                  >
                    <FlagIcon country={option.country} />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          : null}
          {extraActions}
        </div>
      </div>
      <nav className="productNavigation" aria-label={englishOnly ? "Listen" : t("nav.listen")}>
        <Link href="/" className="productNavigationTab" aria-current={pathname === "/" ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 9v6m4-10v14m4-17v20m4-17v14m4-10v6" /></svg>
          {englishOnly ? "Live radio" : t("nav.liveRadio")}
        </Link>
        <Link href={podcastHref} className="productNavigationTab" aria-current={inPodcasts ? "page" : undefined}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 14v-3a8 8 0 0 1 16 0v3M4 13H3v6h4v-6H4Zm16 0h1v6h-4v-6h3Z" /></svg>
          {englishOnly ? "Podcasts" : t("nav.podcasts")}
        </Link>
      </nav>
    </header>
  );
}
