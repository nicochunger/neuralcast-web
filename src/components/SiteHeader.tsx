"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

type ResolvedTheme = "light" | "dark";
type ThemePreference = "system" | ResolvedTheme;

const THEME_STORAGE_KEY = "neuralcast:theme";

export function SiteHeader({ extraActions }: { extraActions?: ReactNode }) {
  const pathname = usePathname();
  const { locale, setLocale, t } = useI18n();
  const [themePreference, setThemePreference] = useState<ThemePreference>("system");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  const languageOptions: Array<{ locale: Locale; label: string; shortLabel: string; country: "us" | "ar" }> = [
    { locale: "en", label: "English", shortLabel: "EN", country: "us" },
    { locale: "es", label: "Español", shortLabel: "ES", country: "ar" }
  ];
  const activeLanguage = languageOptions.find((option) => option.locale === locale) ?? languageOptions[0];

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const initialPreference: ThemePreference = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";

    const updateResolvedTheme = (preference: ThemePreference) => {
      setResolvedTheme(preference === "system" ? (mediaQuery.matches ? "dark" : "light") : preference);
    };

    setThemePreference(initialPreference);
    applyThemePreference(initialPreference);
    updateResolvedTheme(initialPreference);

    const handleSystemThemeChange = () => {
      if (!document.documentElement.dataset.theme) {
        updateResolvedTheme("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

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

  const toggleTheme = () => {
    const nextTheme: ResolvedTheme = resolvedTheme === "dark" ? "light" : "dark";
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemePreference(nextTheme);
    setResolvedTheme(nextTheme);
    applyThemePreference(nextTheme);
  };

  return (
    <header className="appHeader">
      <div className="brandLockup">
        <img src="/neuralcast-logo.png" alt="" className="brandIcon" />
        <div>
          <h1>NeuralCast</h1>
          <p>{t("app.tagline")}</p>
        </div>
      </div>
      <div className="headerActions">
        <nav aria-label={t("nav.label")}>
          <Link className="headerContextLink" href={pathname === "/about" ? "/" : "/about"}>
            {pathname === "/about" ? t("nav.backToRadio") : t("nav.about")}
          </Link>
        </nav>
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
        <button
          className={`themeButton themeButton${resolvedTheme === "dark" ? "Dark" : "Light"}`}
          type="button"
          onClick={toggleTheme}
          aria-label={resolvedTheme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")}
          title={t("theme.title", {
            theme:
              themePreference === "system"
                ? `${t("theme.system")} (${t(`theme.${resolvedTheme}`)})`
                : t(`theme.${resolvedTheme}`),
            action: resolvedTheme === "dark" ? t("theme.switchToLight") : t("theme.switchToDark")
          })}
        >
          <span className="themeIcon" aria-hidden="true">
            <span className="themeSun" />
            <span className="themeMoon" />
          </span>
        </button>
      </div>
    </header>
  );
}

function FlagIcon({ country }: { country: "us" | "ar" }) {
  if (country === "ar") {
    return (
      <svg className="languageFlag" viewBox="0 0 28 20" role="img" aria-label="Argentina flag">
        <rect width="28" height="20" fill="#75aadb" />
        <rect y="6.67" width="28" height="6.66" fill="#ffffff" />
        <circle cx="14" cy="10" r="2.1" fill="#f6b40e" />
        <circle cx="14" cy="10" r="1.1" fill="#d98f00" />
      </svg>
    );
  }

  return (
    <svg className="languageFlag" viewBox="0 0 28 20" role="img" aria-label="United States flag">
      <rect width="28" height="20" fill="#b22234" />
      {Array.from({ length: 6 }, (_, index) => (
        <rect key={index} y={1.54 + index * 3.08} width="28" height="1.54" fill="#ffffff" />
      ))}
      <rect width="11.8" height="10.77" fill="#3c3b6e" />
      {Array.from({ length: 12 }, (_, index) => (
        <circle
          key={index}
          cx={2 + (index % 4) * 2.5}
          cy={2 + Math.floor(index / 4) * 2.5}
          r="0.38"
          fill="#ffffff"
        />
      ))}
    </svg>
  );
}

function applyThemePreference(preference: ThemePreference) {
  if (preference === "system") {
    document.documentElement.removeAttribute("data-theme");
    return;
  }

  document.documentElement.dataset.theme = preference;
}
