"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { MiniPlayer } from "@/components/MiniPlayer";
import {
  getPersistentAudioElement,
  setPersistentPlayerState,
  subscribePersistentPlayer
} from "@/lib/persistentPlayer";
import { STATIONS } from "@/lib/stations";
import type { PlaybackState, StationId } from "@/types/radio";

export function PersistentMiniPlayerOverlay() {
  const pathname = usePathname();
  const [activeStationId, setActiveStationId] = useState<StationId | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [trackText, setTrackText] = useState<string | undefined>(undefined);

  useEffect(() => {
    return subscribePersistentPlayer((state) => {
      setActiveStationId(state.activeStationId);
      setPlaybackState(state.playbackState);
      setTrackText(state.trackText);
    });
  }, []);

  if (pathname === "/" || !activeStationId) {
    return null;
  }

  const station = STATIONS.find((item) => item.id === activeStationId);

  if (!station) {
    return null;
  }

  return (
    <MiniPlayer
      station={station}
      playbackState={playbackState}
      nowPlaying={{ stationId: activeStationId, text: trackText, isLoading: false }}
      onPlay={() => {
        void getPersistentAudioElement().play();
      }}
      onStop={() => {
        const audio = getPersistentAudioElement();
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        setPersistentPlayerState({
          activeStationId,
          playbackState: "idle"
        });
      }}
    />
  );
}
