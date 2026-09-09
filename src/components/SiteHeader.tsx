"use client";

import Link from "next/link";
import { FlagIcon } from "@/components/FlagIcon";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

export function SiteHeader({ extraActions }: { extraActions?: ReactNode }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
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
      <Link className="brandLockup" href="/" aria-label={t("nav.backToRadio")}>
        <img src="/neuralcast-logo-160.webp" alt="" className="brandIcon" width="160" height="160" />
        <div>
          <h1>NeuralCast</h1>
          <p>{t("app.tagline")}</p>
        </div>
      </Link>
      <div className="headerActions">
        <nav aria-label={t("nav.label")}>
          <Link className="headerContextLink" href={pathname === "/about" ? "/" : "/about"}>
            {pathname === "/about" ? t("nav.backToRadio") : t("nav.about")}
          </Link>
        </nav>
        <div className="headerUtilityRow">
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
          {extraActions}
        </div>
      </div>
    </header>
  );
}
