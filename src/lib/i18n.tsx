"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  isLocale,
  resolvePreferredLocale,
  type Locale,
} from "@/lib/locale";
import type { ScheduleSegment, StationId } from "@/types/radio";

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
  | "common.refreshing"
  | "common.submitting"
  | "nav.label"
  | "nav.live"
  | "nav.about"
  | "nav.backToRadio"
  | "footer.connection"
  | "footer.iosInstall"
  | "footer.admin"
  | "auth.eyebrow"
  | "auth.title"
  | "auth.lead"
  | "auth.notConfigured"
  | "auth.configureEnv"
  | "auth.email"
  | "auth.password"
  | "auth.signIn"
  | "auth.signingIn"
  | "auth.error"
  | "auth.signOut"
  | "admin.signedInAs"
  | "admin.controlRoom"
  | "admin.title"
  | "admin.lead"
  | "admin.hostOrchestrator"
  | "admin.hostNotConfigured"
  | "admin.hostConfigured"
  | "admin.loadingCapabilities"
  | "admin.loadCapabilitiesError"
  | "admin.refreshJobError"
  | "admin.loadedCapabilities"
  | "admin.refreshCapabilities"
  | "admin.station"
  | "admin.forceArchetype"
  | "admin.noArchetypes"
  | "admin.archetype"
  | "admin.selectArchetype"
  | "admin.dryRun"
  | "admin.trackFocus"
  | "admin.trackFocusDescription"
  | "admin.useServerDefault"
  | "admin.runForceArchetype"
  | "admin.selectStationAndArchetypeHint"
  | "admin.jobRunning"
  | "admin.forceArchetypeAccepted"
  | "admin.forceArchetypeError"
  | "admin.scheduleGenerator"
  | "admin.scheduleGeneratorDescription"
  | "admin.scheduleGeneratorAccepted"
  | "admin.scheduleGeneratorError"
  | "admin.forceApply"
  | "admin.seedMode"
  | "admin.seedModeDescription"
  | "admin.customSeedKey"
  | "admin.enterCustomSeed"
  | "admin.weekStartDate"
  | "admin.tuning"
  | "admin.tuningDescription"
  | "admin.openRatioMin"
  | "admin.openRatioMax"
  | "admin.minOpenSlots"
  | "admin.maxOpenSlots"
  | "admin.minBlockMinutes"
  | "admin.maxBlockMinutes"
  | "admin.invalidNumber"
  | "admin.invalidInteger"
  | "admin.runScheduleGenerator"
  | "admin.selectStationHint"
  | "admin.forceApplyDisabledHint"
  | "admin.latestHostJob"
  | "admin.polling"
  | "admin.archetypeLine"
  | "admin.focusLine"
  | "admin.modeDryRun"
  | "admin.forceApplyEnabled"
  | "admin.seedModeLine"
  | "admin.customSeedLine"
  | "admin.seedSaltLine"
  | "admin.weekStartLine"
  | "admin.openRatioMinLine"
  | "admin.openRatioMaxLine"
  | "admin.minOpenSlotsLine"
  | "admin.maxOpenSlotsLine"
  | "admin.minBlockMinutesLine"
  | "admin.maxBlockMinutesLine"
  | "admin.exitCodeLine"
  | "admin.acceptedAtLine"
  | "admin.startedAtLine"
  | "admin.finishedAtLine"
  | "admin.jobCompleted"
  | "admin.jobFailed"
  | "admin.focusCurrent"
  | "admin.focusNext"
  | "admin.seedStableWeek"
  | "admin.seedFresh"
  | "admin.seedCustom"
  | "admin.statusAccepted"
  | "admin.statusRunning"
  | "admin.statusSucceeded"
  | "admin.statusFailed"
  | "player.playbackBlocked"
  | "player.streamLoadError"
  | "player.installFallbackAndroid"
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
  | "schedule.close"
  | "stations.ariaLabel"
  | "station.nowPlaying"
  | "station.liveNow"
  | "station.activePlaylists"
  | "station.schedule"
  | "station.requestSong"
  | "station.skipSong"
  | "station.skippingSong"
  | "station.skippedSong"
  | "station.description.neuralcast"
  | "station.description.neuralforge"
  | "request.title"
  | "request.description"
  | "request.close"
  | "request.searchLabel"
  | "request.searchPlaceholder"
  | "request.loading"
  | "request.empty"
  | "request.noMatches"
  | "request.submit"
  | "request.submitting"
  | "request.requested"
  | "request.success"
  | "request.loadError"
  | "request.submitError"
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
  | "theme.title"
  | "about.eyebrow"
  | "about.title"
  | "about.lead"
  | "about.cta.listen"
  | "about.cta.how"
  | "about.philosophy.eyebrow"
  | "about.philosophy.title"
  | "about.philosophy.card1.kicker"
  | "about.philosophy.card1.title"
  | "about.philosophy.card1.body"
  | "about.philosophy.card2.kicker"
  | "about.philosophy.card2.title"
  | "about.philosophy.card2.body"
  | "about.philosophy.card3.kicker"
  | "about.philosophy.card3.title"
  | "about.philosophy.card3.body"
  | "about.why.eyebrow"
  | "about.why.title"
  | "about.why.body1"
  | "about.why.body2"
  | "about.why.stat1.label"
  | "about.why.stat1.value"
  | "about.why.stat2.label"
  | "about.why.stat2.value"
  | "about.why.stat3.label"
  | "about.why.stat3.value"
  | "about.how.eyebrow"
  | "about.how.title"
  | "about.how.step1.title"
  | "about.how.step1.body"
  | "about.how.step2.title"
  | "about.how.step2.body"
  | "about.how.step3.title"
  | "about.how.step3.body"
  | "about.closing.eyebrow"
  | "about.closing.title"
  | "about.closing.body";

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
    "common.refreshing": "Refreshing...",
    "common.submitting": "Submitting...",
    "nav.label": "Primary navigation",
    "nav.live": "Listen",
    "nav.about": "About",
    "nav.backToRadio": "Back to radio",
    "footer.connection": "Live streams require a network connection.",
    "footer.iosInstall": "Add to Home Screen on iOS from the Share menu.",
    "footer.admin": "Admin Console",
    "auth.eyebrow": "Admin access",
    "auth.title": "Sign in to manage NeuralCast",
    "auth.lead": "This private area will be used for live controls like skipping songs and triggering host snippets.",
    "auth.notConfigured": "Admin login is not configured yet.",
    "auth.configureEnv": "Add `NEXTAUTH_SECRET`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` in Vercel and your local env file.",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.signIn": "Sign in",
    "auth.signingIn": "Signing in...",
    "auth.error": "We couldn't sign you in with those credentials.",
    "auth.signOut": "Sign out",
    "admin.signedInAs": "Signed in as {email}.",
    "admin.controlRoom": "Control room",
    "admin.title": "Admin dashboard",
    "admin.lead": "Skip-track controls stay on the main radio page. The full host console lives here and mirrors the Android app's orchestration tools.",
    "admin.hostOrchestrator": "Host orchestrator",
    "admin.hostNotConfigured": "Add `HOST_ADMIN_BASE_URL` and `HOST_ADMIN_TOKEN` in your env vars to unlock the full AI host console.",
    "admin.hostConfigured": "The VPS-backed host admin API is configured server-side for this web app.",
    "admin.loadingCapabilities": "Loading admin capabilities...",
    "admin.loadCapabilitiesError": "Unable to load host admin capabilities.",
    "admin.refreshJobError": "Unable to refresh host job status.",
    "admin.loadedCapabilities": "Loaded {stations} stations, {archetypes} archetypes, and {operations} operations.",
    "admin.refreshCapabilities": "Refresh capabilities",
    "admin.station": "Station",
    "admin.forceArchetype": "Force Archetype",
    "admin.noArchetypes": "No archetypes are loaded yet. Refresh capabilities to fetch them from the server.",
    "admin.archetype": "Archetype",
    "admin.selectArchetype": "Select archetype",
    "admin.dryRun": "Dry run",
    "admin.trackFocus": "Track focus",
    "admin.trackFocusDescription": "Optional. Leave it unset to let the server pick the focus automatically.",
    "admin.useServerDefault": "Use server default",
    "admin.runForceArchetype": "Run Force Archetype",
    "admin.selectStationAndArchetypeHint": "Select a station and archetype to continue.",
    "admin.jobRunning": "Job Running...",
    "admin.forceArchetypeAccepted": "Force archetype request accepted.",
    "admin.forceArchetypeError": "Unable to start a forced host run.",
    "admin.scheduleGenerator": "Schedule Generator",
    "admin.scheduleGeneratorDescription": "Run the schedule generator for the selected station.",
    "admin.scheduleGeneratorAccepted": "Schedule generator request accepted.",
    "admin.scheduleGeneratorError": "Unable to start the schedule generator.",
    "admin.forceApply": "Force apply",
    "admin.seedMode": "Seed mode",
    "admin.seedModeDescription": "Use stable mode for deterministic weekly plans, fresh for a reroll, or custom to reproduce a manual variation.",
    "admin.customSeedKey": "Custom seed key",
    "admin.enterCustomSeed": "Enter a custom seed key first.",
    "admin.weekStartDate": "Week start date (YYYY-MM-DD)",
    "admin.tuning": "Tuning",
    "admin.tuningDescription": "Leave fields blank to use the server defaults.",
    "admin.openRatioMin": "Open ratio min",
    "admin.openRatioMax": "Open ratio max",
    "admin.minOpenSlots": "Min open slots",
    "admin.maxOpenSlots": "Max open slots",
    "admin.minBlockMinutes": "Min block minutes",
    "admin.maxBlockMinutes": "Max block minutes",
    "admin.invalidNumber": "{label} must be a valid number.",
    "admin.invalidInteger": "{label} must be a whole number.",
    "admin.runScheduleGenerator": "Run Schedule Generator",
    "admin.selectStationHint": "Select a station to continue.",
    "admin.forceApplyDisabledHint": "Turn off Dry run to enable Force apply.",
    "admin.latestHostJob": "Latest Host Job",
    "admin.polling": "Polling...",
    "admin.archetypeLine": "Archetype: {value}",
    "admin.focusLine": "Focus: {value}",
    "admin.modeDryRun": "Mode: Dry run",
    "admin.forceApplyEnabled": "Force apply enabled",
    "admin.seedModeLine": "Seed mode: {value}",
    "admin.customSeedLine": "Custom seed: {value}",
    "admin.seedSaltLine": "Seed salt: {value}",
    "admin.weekStartLine": "Week start: {value}",
    "admin.openRatioMinLine": "Open ratio min: {value}",
    "admin.openRatioMaxLine": "Open ratio max: {value}",
    "admin.minOpenSlotsLine": "Min open slots: {value}",
    "admin.maxOpenSlotsLine": "Max open slots: {value}",
    "admin.minBlockMinutesLine": "Min block minutes: {value}",
    "admin.maxBlockMinutesLine": "Max block minutes: {value}",
    "admin.exitCodeLine": "Exit code: {value}",
    "admin.acceptedAtLine": "Accepted: {value}",
    "admin.startedAtLine": "Started: {value}",
    "admin.finishedAtLine": "Finished: {value}",
    "admin.jobCompleted": "{operation} completed for {station}.",
    "admin.jobFailed": "{operation} failed for {station}{suffix}.",
    "admin.focusCurrent": "Current track",
    "admin.focusNext": "Next track",
    "admin.seedStableWeek": "Stable week",
    "admin.seedFresh": "Fresh",
    "admin.seedCustom": "Custom",
    "admin.statusAccepted": "Accepted",
    "admin.statusRunning": "Running",
    "admin.statusSucceeded": "Succeeded",
    "admin.statusFailed": "Failed",
    "player.playbackBlocked":
      "Playback was blocked or the stream could not be reached. Tap Play again after checking the network.",
    "player.streamLoadError": "The stream could not be loaded.",
    "player.installFallbackAndroid":
      "To install on Android, open your browser menu and tap Install app or Add to Home screen.",
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
    "schedule.close": "Close schedule",
    "stations.ariaLabel": "Stations",
    "station.nowPlaying": "Now playing",
    "station.liveNow": "Live now",
    "station.activePlaylists": "Active playlists",
    "station.schedule": "Schedule",
    "station.requestSong": "Request song",
    "station.skipSong": "Skip song",
    "station.skippingSong": "Skipping...",
    "station.skippedSong": "Skipped",
    "station.description.neuralcast": "Mixed AI radio selection",
    "station.description.neuralforge": "Heavy variant with an AI host",
    "request.title": "Request a song",
    "request.description": "Choose a track from the station library. AzuraCast will place it in the request queue when available.",
    "request.close": "Close song requests",
    "request.searchLabel": "Search the catalog",
    "request.searchPlaceholder": "Artist, title, album, or genre",
    "request.loading": "Loading available songs...",
    "request.empty": "No songs are currently available for request.",
    "request.noMatches": "No songs matched your search.",
    "request.submit": "Request",
    "request.submitting": "Sending...",
    "request.requested": "Requested",
    "request.success": "Your request has been submitted.",
    "request.loadError": "Unable to load requestable songs.",
    "request.submitError": "Unable to submit song request.",
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
    "about.eyebrow": "About NeuralCast",
    "about.title": "This started at home, with a radio and a simple problem: choosing what to listen to.",
    "about.lead":
      "My wife and I wanted to listen to more music at home, but choosing what to play always got in the way. We kept coming back to the same things. What we missed was the ease of radio: you turn it on, and something is already playing.",
    "about.cta.listen": "Listen live",
    "about.cta.how": "How it works",
    "about.philosophy.eyebrow": "Philosophy",
    "about.philosophy.title": "How it really began",
    "about.philosophy.card1.kicker": "At home",
    "about.philosophy.card1.title": "I was looking for a better everyday listening experience.",
    "about.philosophy.card1.body":
      "We bought a radio for the house and started exploring internet radio. I loved the idea that we could listen to stations from anywhere in the world, including online-only ones.",
    "about.philosophy.card2.kicker": "Search",
    "about.philosophy.card2.title": "I found good stations, but not the one I actually wanted.",
    "about.philosophy.card2.body":
      "What I wanted was varied, well-known music across different genres. A lot of what I found was interesting, but often too niche or simply not something we wanted on all day at home.",
    "about.philosophy.card3.kicker": "Spark",
    "about.philosophy.card3.title": "That was when building my own station started to feel possible.",
    "about.philosophy.card3.body":
      "I started small with a few old MP3s I still had, just to see if the idea worked. It quickly became obvious that it would not scale, but by then I was already deep in the rabbit hole.",
    "about.why.eyebrow": "The why",
    "about.why.title": "What made this project click was that it solved a real problem and an AI curiosity at the same time.",
    "about.why.body1":
      "At that time I was very interested in building something meaningful with AI. I was actively looking for problems that could be approached with it, and this one fit perfectly because it was already part of our daily life.",
    "about.why.body2":
      "So the project grew into a fully automated system where playlists are generated by AI with my guidance, constraints, and taste steering the outcome. I wanted to build something ambitious, but also something we would actually use every day.",
    "about.why.stat1.label": "Origin",
    "about.why.stat1.value": "A home listening problem",
    "about.why.stat2.label": "Second engine",
    "about.why.stat2.value": "A real desire to build with AI",
    "about.why.stat3.label": "Result",
    "about.why.stat3.value": "A station we actually live with",
    "about.how.eyebrow": "How it works",
    "about.how.title": "What the stations are",
    "about.how.step1.title": "NeuralCast is the shared home mix.",
    "about.how.step1.body":
      "This is the main station we built for daily life at home. It draws from more than 30 playlists across different genres, but all of it is curated around what my wife and I actually enjoy. We are both from Argentina, so there is plenty of music from there alongside classics, famous pop songs, older material, and newer discoveries.",
    "about.how.step2.title": "NeuralForge is where my heavier side goes.",
    "about.how.step2.body":
      "I also really love metal and hard rock, but my wife definitely does not want that as part of the all-day household soundtrack. So I made a separate stream for that side of my taste.",
    "about.how.step3.title": "The AI host is part of the radio experiment too.",
    "about.how.step3.body":
      "I wanted to see whether an AI host could make the station feel more alive by adding personality and context. Right now that host is only active on NeuralForge. My wife prefers NeuralCast as music-only, and since we built this for ourselves and listen to it all day at home, she gets priority on that decision.",
    "about.closing.eyebrow": "Looking ahead",
    "about.closing.title": "This is still a living project, and it is not finished.",
    "about.closing.body":
      "I may still create a parallel version of NeuralCast with the AI host as well. For now the host only speaks Argentinian Spanish, and there is no English version yet. It is still evolving while we live with it.",
  },
  es: {
    "app.tagline": "Radio con IA en vivo desde Estavayer, Suiza.",
    "common.install": "Instalar",
    "common.language": "Idioma",
    "common.play": "Reproducir",
    "common.stop": "Detener",
    "common.loading": "Cargando",
    "common.unavailable": "No disponible",
    "common.liveStream": "Stream en vivo",
    "common.listeners": "Oyentes: {count}",
    "common.listenersUnknown": "Oyentes: --",
    "common.refreshing": "Actualizando...",
    "common.submitting": "Enviando...",
    "nav.label": "Navegación principal",
    "nav.live": "Escuchar",
    "nav.about": "Sobre",
    "nav.backToRadio": "Volver a la radio",
    "footer.connection": "Los streams en vivo requieren conexión de red.",
    "footer.iosInstall": "En iOS, usá el menú Compartir para agregarla a la pantalla de inicio.",
    "footer.admin": "Consola de administración",
    "auth.eyebrow": "Acceso de administración",
    "auth.title": "Iniciá sesión para administrar NeuralCast",
    "auth.lead": "Esta zona privada se usa para controles en vivo, como saltar canciones y activar intervenciones del host.",
    "auth.notConfigured": "El inicio de sesión de administración todavía no está configurado.",
    "auth.configureEnv": "Agregá `NEXTAUTH_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD_HASH` en Vercel y en tu archivo de entorno local.",
    "auth.email": "Email",
    "auth.password": "Contraseña",
    "auth.signIn": "Iniciar sesión",
    "auth.signingIn": "Iniciando sesión...",
    "auth.error": "No pudimos iniciar sesión con esas credenciales.",
    "auth.signOut": "Cerrar sesión",
    "admin.signedInAs": "Sesión iniciada como {email}.",
    "admin.controlRoom": "Sala de control",
    "admin.title": "Panel de administración",
    "admin.lead": "Los controles para saltar canciones quedan en la página principal de la radio. La consola completa del host vive acá y sigue las mismas herramientas de coordinación que la app de Android.",
    "admin.hostOrchestrator": "Coordinador del host",
    "admin.hostNotConfigured": "Agregá `HOST_ADMIN_BASE_URL` y `HOST_ADMIN_TOKEN` en tus variables de entorno para habilitar la consola completa del host con IA.",
    "admin.hostConfigured": "La API de administración del host en el VPS está configurada en el servidor para esta app web.",
    "admin.loadingCapabilities": "Cargando opciones de administración...",
    "admin.loadCapabilitiesError": "No se pudieron cargar las opciones de administración del host.",
    "admin.refreshJobError": "No se pudo actualizar el estado de la tarea del host.",
    "admin.loadedCapabilities": "Se cargaron {stations} emisoras, {archetypes} arquetipos y {operations} operaciones.",
    "admin.refreshCapabilities": "Actualizar opciones",
    "admin.station": "Emisora",
    "admin.forceArchetype": "Forzar arquetipo",
    "admin.noArchetypes": "Todavía no hay arquetipos cargados. Actualizá las opciones para traerlos desde el servidor.",
    "admin.archetype": "Arquetipo",
    "admin.selectArchetype": "Seleccionar arquetipo",
    "admin.dryRun": "Prueba",
    "admin.trackFocus": "Foco de canción",
    "admin.trackFocusDescription": "Opcional. Dejalo sin configurar para que el servidor elija el foco automáticamente.",
    "admin.useServerDefault": "Usar valor del servidor",
    "admin.runForceArchetype": "Ejecutar arquetipo forzado",
    "admin.selectStationAndArchetypeHint": "Seleccioná una emisora y un arquetipo para continuar.",
    "admin.jobRunning": "Tarea en ejecución...",
    "admin.forceArchetypeAccepted": "Solicitud de arquetipo forzado aceptada.",
    "admin.forceArchetypeError": "No se pudo iniciar una ejecución forzada del host.",
    "admin.scheduleGenerator": "Generador de programación",
    "admin.scheduleGeneratorDescription": "Ejecutar el generador de programación para la emisora seleccionada.",
    "admin.scheduleGeneratorAccepted": "Solicitud del generador de programación aceptada.",
    "admin.scheduleGeneratorError": "No se pudo iniciar el generador de programación.",
    "admin.forceApply": "Aplicar cambios",
    "admin.seedMode": "Modo de semilla",
    "admin.seedModeDescription": "Usá el modo estable para planes semanales deterministas, fresco para generar una nueva variante, o personalizado para repetir una variación manual.",
    "admin.customSeedKey": "Clave de semilla personalizada",
    "admin.enterCustomSeed": "Primero ingresá una clave de semilla personalizada.",
    "admin.weekStartDate": "Fecha de inicio de semana (YYYY-MM-DD)",
    "admin.tuning": "Ajustes",
    "admin.tuningDescription": "Dejá los campos vacíos para usar los valores predeterminados del servidor.",
    "admin.openRatioMin": "Proporción abierta mín.",
    "admin.openRatioMax": "Proporción abierta máx.",
    "admin.minOpenSlots": "Mín. espacios abiertos",
    "admin.maxOpenSlots": "Máx. espacios abiertos",
    "admin.minBlockMinutes": "Minutos mín. de bloque",
    "admin.maxBlockMinutes": "Minutos máx. de bloque",
    "admin.invalidNumber": "{label} debe ser un número válido.",
    "admin.invalidInteger": "{label} debe ser un número entero.",
    "admin.runScheduleGenerator": "Ejecutar generador",
    "admin.selectStationHint": "Seleccioná una emisora para continuar.",
    "admin.forceApplyDisabledHint": "Desactivá Simulación para habilitar Aplicación forzada.",
    "admin.latestHostJob": "Última tarea del host",
    "admin.polling": "Consultando...",
    "admin.archetypeLine": "Arquetipo: {value}",
    "admin.focusLine": "Foco: {value}",
    "admin.modeDryRun": "Modo: prueba",
    "admin.forceApplyEnabled": "Aplicación forzada activada",
    "admin.seedModeLine": "Modo de semilla: {value}",
    "admin.customSeedLine": "Semilla personalizada: {value}",
    "admin.seedSaltLine": "Sal de semilla: {value}",
    "admin.weekStartLine": "Inicio de semana: {value}",
    "admin.openRatioMinLine": "Proporción abierta mín.: {value}",
    "admin.openRatioMaxLine": "Proporción abierta máx.: {value}",
    "admin.minOpenSlotsLine": "Mín. espacios abiertos: {value}",
    "admin.maxOpenSlotsLine": "Máx. espacios abiertos: {value}",
    "admin.minBlockMinutesLine": "Minutos mín. de bloque: {value}",
    "admin.maxBlockMinutesLine": "Minutos máx. de bloque: {value}",
    "admin.exitCodeLine": "Código de salida: {value}",
    "admin.acceptedAtLine": "Aceptado: {value}",
    "admin.startedAtLine": "Iniciado: {value}",
    "admin.finishedAtLine": "Finalizado: {value}",
    "admin.jobCompleted": "{operation} completado para {station}.",
    "admin.jobFailed": "{operation} falló para {station}{suffix}.",
    "admin.focusCurrent": "Canción actual",
    "admin.focusNext": "Próxima canción",
    "admin.seedStableWeek": "Semana estable",
    "admin.seedFresh": "Fresco",
    "admin.seedCustom": "Personalizado",
    "admin.statusAccepted": "Aceptado",
    "admin.statusRunning": "En ejecución",
    "admin.statusSucceeded": "Completado",
    "admin.statusFailed": "Fallido",
    "player.playbackBlocked":
      "La reproducción se bloqueó o no se pudo acceder al stream. Tocá Reproducir de nuevo después de comprobar la red.",
    "player.streamLoadError": "No se pudo cargar el stream.",
    "player.installFallbackAndroid":
      "Para instalar en Android, abrí el menú del navegador y tocá Instalar aplicación o Agregar a la pantalla de inicio.",
    "schedule.title": "Programación de {station}",
    "schedule.description": "Mirá lo que suena ahora y lo que viene después durante el día.",
    "schedule.error": "Programación no disponible.",
    "schedule.blocks": "{count} bloques",
    "schedule.summary.liveNow": "En vivo",
    "schedule.summary.upNext": "Sigue",
    "schedule.empty": "Programación no disponible.",
    "schedule.toolbar": "Vista de 24 horas · hora de Zúrich (CET/CEST)",
    "schedule.now": "Ahora {time}",
    "schedule.ariaLabel": "Programación de 24 horas de {station} para {date}",
    "schedule.close": "Cerrar programación",
    "stations.ariaLabel": "Emisoras",
    "station.nowPlaying": "Sonando ahora",
    "station.liveNow": "En vivo",
    "station.activePlaylists": "Listas activas",
    "station.schedule": "Programación",
    "station.requestSong": "Pedir canción",
    "station.skipSong": "Saltar canción",
    "station.skippingSong": "Saltando...",
    "station.skippedSong": "Saltada",
    "station.description.neuralcast": "Selección mixta de radio con IA",
    "station.description.neuralforge": "Variante pesada con un locutor de IA",
    "request.title": "Pedir una canción",
    "request.description": "Elegí una canción de la biblioteca de la emisora. AzuraCast la pondrá en la cola de pedidos cuando esté disponible.",
    "request.close": "Cerrar pedidos de canciones",
    "request.searchLabel": "Buscar en el catálogo",
    "request.searchPlaceholder": "Artista, canción, álbum o género",
    "request.loading": "Cargando canciones disponibles...",
    "request.empty": "No hay canciones disponibles para pedir en este momento.",
    "request.noMatches": "No hay canciones que coincidan con tu búsqueda.",
    "request.submit": "Pedir",
    "request.submitting": "Enviando...",
    "request.requested": "Pedida",
    "request.success": "Tu pedido fue enviado.",
    "request.loadError": "No se pudieron cargar las canciones disponibles.",
    "request.submitError": "No se pudo enviar el pedido.",
    "track.waiting": "Esperando los metadatos en vivo.",
    "track.unavailable": "Metadatos no disponibles.",
    "status.ready": "Listo",
    "status.buffering": "Cargando",
    "status.onAir": "En el aire",
    "status.paused": "Pausado",
    "status.streamError": "Error del stream",
    "theme.light": "modo claro",
    "theme.dark": "modo oscuro",
    "theme.system": "sistema",
    "theme.switchToLight": "Cambiar a modo claro",
    "theme.switchToDark": "Cambiar a modo oscuro",
    "theme.title": "Modo: {theme}. {action}",
    "about.eyebrow": "Sobre NeuralCast",
    "about.title": "Esto empezó en casa, con una radio y un problema muy simple: elegir qué escuchar.",
    "about.lead":
      "Mi esposa y yo queríamos escuchar más música en casa, pero elegir qué poner siempre terminaba metiendo fricción. Muchas veces volvíamos a lo mismo de siempre. Lo que extrañábamos era la facilidad de la radio: la prendés y ya hay algo sonando.",
    "about.cta.listen": "Escuchar en vivo",
    "about.cta.how": "Cómo funciona",
    "about.philosophy.eyebrow": "Filosofía",
    "about.philosophy.title": "Cómo empezó de verdad",
    "about.philosophy.card1.kicker": "En casa",
    "about.philosophy.card1.title": "Yo estaba buscando una mejor experiencia para escuchar música todos los días.",
    "about.philosophy.card1.body":
      "Compramos una radio para la casa y empezamos a explorar radios por internet. Me encantaba la idea de poder escuchar emisoras de cualquier parte del mundo, incluso las que existen solo online.",
    "about.philosophy.card2.kicker": "Búsqueda",
    "about.philosophy.card2.title": "Encontré radios buenas, pero no la que realmente quería.",
    "about.philosophy.card2.body":
      "Lo que yo quería era música conocida, variada y de distintos géneros. Muchas de las radios que encontré estaban buenas, pero eran demasiado de nicho o simplemente no eran algo que quisiéramos tener sonando todo el día en casa.",
    "about.philosophy.card3.kicker": "Disparo",
    "about.philosophy.card3.title": "Ahí fue cuando hacer mi propia radio empezó a parecer posible.",
    "about.philosophy.card3.body":
      "Empecé de a poco, con algunos MP3 viejos que todavía tenía, solo para ver si la idea funcionaba. Muy rápido quedó claro que así no podía escalar, pero para ese momento yo ya estaba completamente metido en el asunto.",
    "about.why.eyebrow": "El porqué",
    "about.why.title": "Lo que hizo encajar este proyecto fue que resolvía un problema real y una inquietud con IA al mismo tiempo.",
    "about.why.body1":
      "En ese momento yo tenía muchas ganas de construir algo significativo con IA. Estaba buscando activamente problemas que se pudieran abordar con ella, y este encajó especialmente bien porque ya formaba parte de nuestra vida cotidiana.",
    "about.why.body2":
      "Así fue como el proyecto terminó convirtiéndose en un sistema totalmente automatizado donde las playlists se generan con IA, pero guiadas por mi criterio, mis límites y mi gusto. Quería construir algo ambicioso, pero también algo que usáramos de verdad todos los días.",
    "about.why.stat1.label": "Origen",
    "about.why.stat1.value": "Un problema real en casa",
    "about.why.stat2.label": "Segundo motor",
    "about.why.stat2.value": "Ganas reales de construir con IA",
    "about.why.stat3.label": "Resultado",
    "about.why.stat3.value": "Una radio con la que convivimos",
    "about.how.eyebrow": "Cómo funciona",
    "about.how.title": "Qué son las emisoras",
    "about.how.step1.title": "NeuralCast es la mezcla compartida de la casa.",
    "about.how.step1.body":
      "Esta es la emisora principal que armamos para la vida de todos los días en casa. Se alimenta de más de 30 playlists de géneros distintos, pero todo está curado alrededor de lo que realmente nos gusta escuchar a mi esposa y a mí. Los dos somos de Argentina, así que hay bastante música de allá junto a clásicos, canciones pop muy conocidas, cosas más viejas y también material más nuevo.",
    "about.how.step2.title": "NeuralForge es donde va mi costado más pesado.",
    "about.how.step2.body":
      "A mí también me gusta mucho el metal y el hard rock, pero mi esposa definitivamente no quiere eso como parte del paisaje sonoro de la casa durante todo el día. Por eso armé una emisora separada para ese lado de mi gusto.",
    "about.how.step3.title": "El host de IA también forma parte del experimento.",
    "about.how.step3.body":
      "Quería probar si un host con IA podía hacer que la radio se sintiera más viva, aportando personalidad y contexto. Por ahora ese host solo está activo en NeuralForge. Mi esposa prefiere NeuralCast sin intervenciones, y como al final del día esto lo construimos para nosotros y lo escuchamos casi todo el tiempo en casa, ella tiene prioridad en esa decisión.",
    "about.closing.eyebrow": "Lo que viene",
    "about.closing.title": "Esto sigue siendo un proyecto vivo y todavía no está terminado.",
    "about.closing.body":
      "Todavía es posible que haga una versión paralela de NeuralCast con el host de IA también. Por ahora el host habla solo en español rioplatense y no existe una versión en inglés. Sigue tomando forma mientras convivimos con él.",
  }
};

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);
const COOKIE_MAX_AGE_SECONDS = 31536000;

export function LanguageProvider({
  children,
  initialLocale
}: {
  children: ReactNode;
  initialLocale: Locale;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);
  const [hasRestoredLocale, setHasRestoredLocale] = useState(false);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY) ?? readLocaleCookie();
    const preferredLocale = resolvePreferredLocale({
      storedLocale,
      browserLanguage: window.navigator.language
    });

    setLocale(preferredLocale);
    setHasRestoredLocale(true);
  }, []);

  useEffect(() => {
    if (!hasRestoredLocale) {
      return;
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.cookie = `${LOCALE_COOKIE_KEY}=${locale}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    document.documentElement.lang = locale;
  }, [hasRestoredLocale, locale]);

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

function interpolate(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (message, [key, value]) => message.replaceAll(`{${key}}`, String(value)),
    template
  );
}

function readLocaleCookie(): Locale | undefined {
  const localeCookie = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${LOCALE_COOKIE_KEY}=`));

  const value = localeCookie?.slice(LOCALE_COOKIE_KEY.length + 1);
  return isLocale(value) ? value : undefined;
}
