"use client";

import Link from "next/link";
import { FlagIcon } from "@/components/FlagIcon";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import type { StationId } from "@/types/radio";
import type { Locale } from "@/lib/locale";

export function SiteHeader({
  extraActions,
  englishOnly = false,
  podcastStation,
  exploreStation
}: {
  extraActions?: ReactNode;
  englishOnly?: boolean;
  podcastStation?: StationId;
  exploreStation?: StationId;
}) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const inPodcasts = pathname.startsWith("/episodes");
  const inExplore = pathname.startsWith("/explore");
  const pathStation = pathname.match(/^\/episodes\/(neuralcast|neuralforge)\//)?.[1] as StationId | undefined;
  const selectedStation = exploreStation ?? podcastStation ?? pathStation;
  const podcastHref = selectedStation ? `/episodes?station=${selectedStation}` : "/episodes";
  const exploreHref = selectedStation ? `/explore?station=${selectedStation}` : "/explore";
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
    <>
      <header className="appHeader">
        <div className="appHeaderBar">
          <Link className="brandLockup" href="/" aria-label={englishOnly ? "Back to radio" : t("nav.backToRadio")}>
            <img src="/neuralcast-logo-160.webp" alt="" className="brandIcon" width="40" height="40" />
            <span className="brandWordmark">NeuralCast</span>
          </Link>

          <nav className="primaryNavigation" aria-label={englishOnly ? "Primary navigation" : t("nav.label")}>
            <Link href="/" className="primaryNavLink" aria-current={pathname === "/" ? "page" : undefined}>
              {englishOnly ? "Live radio" : t("nav.liveRadio")}
            </Link>
            <Link href={podcastHref} className="primaryNavLink" aria-current={inPodcasts ? "page" : undefined}>
              {englishOnly ? "Podcasts" : t("nav.podcasts")}
            </Link>
            <Link href={exploreHref} className="primaryNavLink" aria-current={inExplore ? "page" : undefined}>
              {englishOnly ? "Explore" : t("nav.explore")}
            </Link>
            <Link href="/about" className="primaryNavLink" aria-current={pathname === "/about" ? "page" : undefined}>
              {englishOnly ? "About" : t("nav.about")}
            </Link>
          </nav>

          <div className="headerActions">
            <div className="headerUtilityRow">
              {!englishOnly ? (
                <div className="languageMenu" ref={languageMenuRef}>
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
              ) : null}
              {extraActions}
            </div>
          </div>
        </div>
      </header>

      {pathname === "/" ? (
        <div className="listeningIntroduction">
          <h1>{t("stations.introTitle")}</h1>
          <p>{t("stations.introDescription")}</p>
        </div>
      ) : null}
    </>
  );
}
