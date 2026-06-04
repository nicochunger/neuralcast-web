export const LOCALE_STORAGE_KEY = "neuralcast:locale";
export const LOCALE_COOKIE_KEY = "neuralcast-locale";

export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

const SPANISH_SPEAKING_COUNTRIES = new Set([
  "AR",
  "BO",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "ES",
  "GQ",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PE",
  "PR",
  "PY",
  "SV",
  "UY",
  "VE"
]);

interface ResolveLocaleOptions {
  storedLocale?: string | null;
  browserLanguage?: string | null;
  countryCode?: string | null;
}

export function resolvePreferredLocale({
  storedLocale,
  browserLanguage,
  countryCode
}: ResolveLocaleOptions): Locale {
  if (isLocale(storedLocale)) {
    return storedLocale;
  }

  const normalizedBrowserLanguage = browserLanguage?.toLowerCase();

  if (normalizedBrowserLanguage?.startsWith("es")) {
    return "es";
  }

  const normalizedCountryCode = countryCode?.toUpperCase();

  if (normalizedCountryCode && SPANISH_SPEAKING_COUNTRIES.has(normalizedCountryCode)) {
    return "es";
  }

  return DEFAULT_LOCALE;
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value !== null && value !== undefined && SUPPORTED_LOCALES.includes(value as Locale);
}
