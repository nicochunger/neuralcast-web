"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import type { PublishedEpisode } from "@/types/episode";
import { useI18n } from "@/lib/i18n";
import { STATIONS } from "@/lib/stations";

type State = "paused" | "playing" | "buffering" | "error";
interface EpisodePlayback {
  episode?: PublishedEpisode;
  position: number;
  state: State;
  active: boolean;
  error?: string;
  play: (episode: PublishedEpisode, position?: number) => Promise<void>;
  pause: () => void;
  seek: (seconds: number) => void;
}
const Context = createContext<EpisodePlayback | null>(null);
const key = (episode: PublishedEpisode) => `neuralcast:episode:${episode.station}:${episode.id}:${episode.revision}`;
const same = (a: PublishedEpisode | undefined, b: PublishedEpisode) => a?.id === b.id && a.station === b.station && a.revision === b.revision;

export function EpisodePlayerProvider({ children }: { children: ReactNode }) {
  const { stopPlayback, volume } = useAudioPlayer();
  const { t } = useI18n();
  const [episode, setEpisode] = useState<PublishedEpisode>();
  const [position, setPosition] = useState(0);
  const [state, setState] = useState<State>("paused");
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string>();
  const selected = useRef<PublishedEpisode | undefined>(undefined);
  const owned = useRef(false);
  const pendingSeek = useRef<number | undefined>(undefined);
  const lastSaved = useRef(0);
  const audio = useCallback(() => document.getElementById("neuralcast-episode-audio") as HTMLAudioElement, []);
  const save = useCallback(() => {
    if (!selected.current || pendingSeek.current !== undefined || audio().readyState < 1) return;
    try { localStorage.setItem(key(selected.current), String(audio().ended ? 0 : audio().currentTime)); } catch { /* Storage can be disabled. */ }
  }, [audio]);
  const pause = useCallback(() => { audio().pause(); save(); setState("paused"); }, [audio, save]);
  const seek = useCallback((seconds: number) => {
    const current = selected.current;
    if (!current || !Number.isFinite(seconds)) return;
    const value = Math.min(current.duration, Math.max(0, seconds));
    if (audio().readyState >= 1) { audio().currentTime = value; pendingSeek.current = undefined; }
    else pendingSeek.current = value;
    setPosition(value);
    if (audio().readyState >= 1) save();
  }, [audio, save]);
  const play = useCallback(async (next: PublishedEpisode, at?: number) => {
    save();
    stopPlayback();
    owned.current = true;
    setActive(true);
    window.dispatchEvent(new Event("neuralcast:episode-active"));
    const element = audio();
    if (!same(selected.current, next)) {
      element.pause();
      selected.current = next;
      setEpisode(next);
      let stored = 0;
      try { stored = Number(localStorage.getItem(key(next)) ?? 0); } catch { /* Start at zero. */ }
      const resume = Number.isFinite(stored) && stored >= 0 && stored < next.duration - 3 ? stored : 0;
      element.src = next.audio_url;
      pendingSeek.current = at ?? resume;
      setPosition(pendingSeek.current);
      element.load();
    } else if (at !== undefined) seek(at);
    else if (element.ended) seek(0);
    setState("buffering");
    setError(undefined);
    try { await element.play(); }
    catch { if (owned.current) { setState("error"); setError(t("episodes.playbackError")); } }
  }, [audio, save, seek, stopPlayback, t]);

  useEffect(() => { audio().volume = volume; }, [audio, volume]);
  useEffect(() => {
    const element = audio();
    const metadata = () => {
      if (pendingSeek.current !== undefined) {
        element.currentTime = Math.max(0, Math.min(pendingSeek.current, element.duration));
        pendingSeek.current = undefined;
      }
    };
    const progress = () => {
      setPosition(element.currentTime);
      if (Date.now() - lastSaved.current > 5000) { save(); lastSaved.current = Date.now(); }
    };
    const playing = () => { setState("playing"); setError(undefined); };
    const paused = () => { setState("paused"); save(); };
    const waiting = () => { if (owned.current && !element.paused) setState("buffering"); };
    const failed = () => { if (owned.current) { setState("error"); setError(t("episodes.playbackError")); } };
    const live = () => { owned.current = false; setActive(false); element.pause(); save(); };
    element.addEventListener("loadedmetadata", metadata);
    element.addEventListener("timeupdate", progress);
    element.addEventListener("seeked", progress);
    element.addEventListener("playing", playing);
    element.addEventListener("pause", paused);
    element.addEventListener("ended", paused);
    element.addEventListener("waiting", waiting);
    element.addEventListener("error", failed);
    window.addEventListener("neuralcast:play-live", live);
    window.addEventListener("pagehide", save);
    return () => {
      element.removeEventListener("loadedmetadata", metadata);
      element.removeEventListener("timeupdate", progress);
      element.removeEventListener("seeked", progress);
      element.removeEventListener("playing", playing);
      element.removeEventListener("pause", paused);
      element.removeEventListener("ended", paused);
      element.removeEventListener("waiting", waiting);
      element.removeEventListener("error", failed);
      window.removeEventListener("neuralcast:play-live", live);
      window.removeEventListener("pagehide", save);
    };
  }, [audio, save, t]);

  useEffect(() => {
    if (!active || !episode || !("mediaSession" in navigator)) return;
    const session = navigator.mediaSession;
    const station = STATIONS.find((item) => item.id === episode.station)!;
    if ("MediaMetadata" in window) session.metadata = new MediaMetadata({ title: episode.title, artist: station.name, album: t("episodes.title"), artwork: [{ src: new URL(station.artworkImage, location.origin).href }] });
    session.playbackState = state === "playing" ? "playing" : "paused";
    const actions: Partial<Record<MediaSessionAction, MediaSessionActionHandler>> = {
      play: () => { void play(episode); }, pause, stop: pause,
      seekto: (details) => { if (details.seekTime !== undefined) seek(details.seekTime); },
      seekbackward: (details) => seek(audio().currentTime - (details.seekOffset ?? 15)),
      seekforward: (details) => seek(audio().currentTime + (details.seekOffset ?? 15))
    };
    for (const [action, handler] of Object.entries(actions)) {
      try { session.setActionHandler(action as MediaSessionAction, handler!); } catch { /* Unsupported action. */ }
    }
    return () => { for (const action of Object.keys(actions)) { try { session.setActionHandler(action as MediaSessionAction, null); } catch { /* Unsupported action. */ } } };
  }, [active, episode, state, play, pause, seek, audio, t]);

  useEffect(() => {
    if (!active || !episode || !("mediaSession" in navigator)) return;
    try { navigator.mediaSession.setPositionState({ duration: episode.duration, playbackRate: 1, position: Math.min(position, episode.duration) }); } catch { /* Older clients. */ }
  }, [active, episode, position]);

  return <Context.Provider value={{ episode, position, state, active, error, play, pause, seek }}>{children}</Context.Provider>;
}
export function useEpisodePlayer() {
  const value = useContext(Context);
  if (!value) throw new Error("EpisodePlayerProvider is required");
  return value;
}
