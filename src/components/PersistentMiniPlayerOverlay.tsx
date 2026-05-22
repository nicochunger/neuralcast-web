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
import type { PlaybackState, StationId, StationNowPlayingState } from "@/types/radio";

export function PersistentMiniPlayerOverlay() {
  const pathname = usePathname();
  const [activeStationId, setActiveStationId] = useState<StationId | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const [nowPlaying, setNowPlaying] = useState<StationNowPlayingState | undefined>(undefined);

  useEffect(() => {
    return subscribePersistentPlayer((state) => {
      setActiveStationId(state.activeStationId);
      setPlaybackState(state.playbackState);
      setNowPlaying(state.nowPlaying);
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
      nowPlaying={nowPlaying ?? { stationId: activeStationId, isLoading: false }}
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
