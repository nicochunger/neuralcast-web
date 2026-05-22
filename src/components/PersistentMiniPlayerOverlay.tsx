"use client";

import { usePathname } from "next/navigation";
import { MiniPlayer } from "@/components/MiniPlayer";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { STATIONS } from "@/lib/stations";

export function PersistentMiniPlayerOverlay() {
  const pathname = usePathname();
  const { activeStationId, activeStation, playbackState, nowPlaying, playStation, stopPlayback } = useAudioPlayer();

  if (pathname === "/" || !activeStationId) {
    return null;
  }

  const station = STATIONS.find((item) => item.id === activeStationId) ?? activeStation;

  return (
    <MiniPlayer
      station={station}
      playbackState={playbackState}
      nowPlaying={nowPlaying[activeStationId] ?? { stationId: activeStationId, isLoading: false }}
      onPlay={playStation}
      onStop={stopPlayback}
    />
  );
}
