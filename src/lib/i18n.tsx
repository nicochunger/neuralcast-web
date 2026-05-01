"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ScheduleSegment, StationId } from "@/types/radio";

const LOCALE_STORAGE_KEY = "neuralcast:locale";

export const SUPPORTED_LOCALES = ["en", "es"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

type TranslationKey =
  | "app.tagline"
  | "common.install"
  | "common.language"
  | "common.play"
  | "common.stop"
  | "common.loading"
  | "common.unavailable"
  | "common.liveStream"
  | "common.listeners"
  | "common.listenersUnknown"
  | "footer.connection"
  | "footer.iosInstall"
  | "player.playbackBlocked"
  | "player.streamLoadError"
  | "schedule.title"
  | "schedule.description"
  | "schedule.error"
  | "schedule.blocks"
  | "schedule.summary.liveNow"
  | "schedule.summary.upNext"
  | "schedule.empty"
  | "schedule.toolbar"
  | "schedule.now"
  | "schedule.ariaLabel"
  | "stations.ariaLabel"
  | "station.nowPlaying"
  | "station.liveNow"
  | "station.schedule"
  | "station.description.neuralcast"
  | "station.description.neuralforge"
  | "track.waiting"
  | "track.unavailable"
  | "status.ready"
  | "status.buffering"
  | "status.onAir"
  | "status.paused"
  | "status.streamError"
  | "theme.light"
  | "theme.dark"
  | "theme.system"
  | "theme.switchToLight"
  | "theme.switchToDark"
  | "theme.title";

type TranslationParams = Record<string, string | number>;

const messages: Record<Locale, Record<TranslationKey, string>> = {
  en: {
    "app.tagline": "Live AI radio from Estavayer, Switzerland.",
    "common.install": "Install",
    "common.language": "Language",
    "common.play": "Play",
    "common.stop": "Stop",
    "common.loading": "Loading",
    "common.unavailable": "Unavailable",
    "common.liveStream": "Live stream",
    "common.listeners": "Listeners: {count}",
    "common.listenersUnknown": "Listeners: --",
    "footer.connection": "Live streams require a network connection.",
    "footer.iosInstall": "Add to Home Screen on iOS from the Share menu.",
    "player.playbackBlocked":
      "Playback was blocked or the stream could not be reached. Tap Play again after checking the network.",
    "player.streamLoadError": "The stream could not be loaded.",
    "schedule.title": "{station} schedule",
    "schedule.description": "See what is playing now and what is coming up through the day.",
    "schedule.error": "Schedule unavailable.",
    "schedule.blocks": "{count} blocks",
    "schedule.summary.liveNow": "Live now",
    "schedule.summary.upNext": "Up next",
    "schedule.empty": "Schedule unavailable.",
    "schedule.toolbar": "24-hour view · Zurich time (CET/CEST)",
    "schedule.now": "Now {time}",
    "schedule.ariaLabel": "{station} 24 hour schedule for {date}",
    "stations.ariaLabel": "Stations",
    "station.nowPlaying": "Now playing",
    "station.liveNow": "Live now",
    "station.schedule": "Schedule",
    "station.description.neuralcast": "Curated AI radio",
    "station.description.neuralforge": "Forged for heavy rotation",
    "track.waiting": "Waiting for live metadata.",
    "track.unavailable": "Metadata unavailable.",
    "status.ready": "Ready",
    "status.buffering": "Buffering",
    "status.onAir": "On air",
    "status.paused": "Paused",
    "status.streamError": "Stream error",
    "theme.light": "light",
    "theme.dark": "dark",
    "theme.system": "system",
    "theme.switchToLight": "Switch to light theme",
    "theme.switchToDark": "Switch to dark theme",
    "theme.title": "Theme: {theme}. {action}",
  },
  es: {
    "app.tagline": "Radio AI en directo desde Estavayer, Suiza.",
    "common.install": "Instalar",
    "common.language": "Idioma",
    "common.play": "Reproducir",
    "common.stop": "Detener",
    "common.loading": "Cargando",
    "common.unavailable": "No disponible",
    "common.liveStream": "Transmisión en directo",
    "common.listeners": "Oyentes: {count}",
    "common.listenersUnknown": "Oyentes: --",
    "footer.connection": "Las transmisiones en directo requieren conexión de red.",
    "footer.iosInstall": "En iOS, usa el menú Compartir para añadirla a la pantalla de inicio.",
    "player.playbackBlocked":
      "La reproducción se bloqueó o no se pudo acceder a la transmisión. Pulsa Reproducir de nuevo después de comprobar la red.",
    "player.streamLoadError": "No se pudo cargar la transmisión.",
    "schedule.title": "Programación de {station}",
    "schedule.description": "Mira lo que suena ahora y lo que viene después durante el día.",
    "schedule.error": "Programación no disponible.",
    "schedule.blocks": "{count} bloques",
    "schedule.summary.liveNow": "En directo",
    "schedule.summary.upNext": "A continuación",
    "schedule.empty": "Programación no disponible.",
    "schedule.toolbar": "Vista de 24 horas · hora de Zúrich (CET/CEST)",
    "schedule.now": "Ahora {time}",
    "schedule.ariaLabel": "Programación de 24 horas de {station} para {date}",
    "stations.ariaLabel": "Emisoras",
    "station.nowPlaying": "Sonando ahora",
    "station.liveNow": "En directo",
    "station.schedule": "Programación",
    "station.description.neuralcast": "Radio AI seleccionada",
    "station.description.neuralforge": "Forjada para rotación intensa",
    "track.waiting": "Esperando los metadatos en directo.",
    "track.unavailable": "Metadatos no disponibles.",
    "status.ready": "Listo",
    "status.buffering": "Cargando",
    "status.onAir": "En el aire",
    "status.paused": "Pausado",
    "status.streamError": "Error de transmisión",
    "theme.light": "claro",
    "theme.dark": "oscuro",
    "theme.system": "sistema",
    "theme.switchToLight": "Cambiar al tema claro",
    "theme.switchToDark": "Cambiar al tema oscuro",
    "theme.title": "Tema: {theme}. {action}",
  }
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>(getInitialLocale);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        t: (key, params) => interpolate(messages[locale][key], params)
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within LanguageProvider.");
  }

  return context;
}

export function getSegmentTitle(
  segment: ScheduleSegment | undefined,
  locale: Locale
): string {
  if (!segment) {
    return locale === "es" ? "Esperando la programación." : "Waiting for schedule.";
  }

  if (segment.kind === "open-slot") {
    return locale === "es" ? "Espacio libre" : "Open slot";
  }

  if (segment.kind === "open-rotation") {
    return locale === "es" ? "Rotación abierta" : "Open rotation";
  }

  if (segment.playlistNames.length === 1) {
    return segment.playlistNames[0];
  }

  return locale === "es"
    ? `${segment.playlistNames.length} listas activas`
    : `${segment.playlistNames.length} active playlists`;
}

export function getSegmentDetail(
  segment: ScheduleSegment | undefined,
  locale: Locale
): string {
  if (!segment) {
    return locale === "es" ? "Se están cargando los metadatos de la programación." : "Schedule metadata is loading.";
  }

  if (segment.kind === "open-slot") {
    return locale === "es" ? "No hay nada programado en esta franja." : "Nothing scheduled in this window.";
  }

  if (segment.kind === "open-rotation") {
    return locale === "es" ? "Mezcla amplia de la rotación activa." : "Broad mix from the active rotation.";
  }

  return segment.playlistNames.join(", ");
}

export function getStationDescription(stationId: StationId, t: I18nContextValue["t"]): string {
  return t(`station.description.${stationId}`);
}

function getInitialLocale(): Locale {
  if (typeof window === "undefined") {
    return "en";
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  if (isLocale(storedLocale)) {
    return storedLocale;
  }

  const browserLocale = window.navigator.language.toLowerCase();
  return browserLocale.startsWith("es") ? "es" : "en";
}

function isLocale(value: string | null): value is Locale {
  return value !== null && SUPPORTED_LOCALES.includes(value as Locale);
}

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template
  );
}
