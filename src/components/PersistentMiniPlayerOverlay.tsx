"use client";

import { usePathname } from "next/navigation";
import { MiniPlayer } from "@/components/MiniPlayer";
import { ArtworkLightbox, type ArtworkLightboxData } from "@/components/ArtworkLightbox";
import { useAudioPlayer } from "@/context/AudioPlayerContext";
import { STATIONS } from "@/lib/stations";
import { useState } from "react";

export function PersistentMiniPlayerOverlay() {
  const pathname = usePathname();
  const [artwork, setArtwork] = useState<ArtworkLightboxData | undefined>();
  const {
    activeStationId,
    activeStation,
    playbackState,
    currentTime,
    nowPlaying,
    volume,
    playStation,
    stopPlayback,
    setVolume,
    toggleMute
  } = useAudioPlayer();

  if (pathname === "/" || !activeStationId) {
    return null;
  }

  const station = STATIONS.find((item) => item.id === activeStationId) ?? activeStation;

  return (
    <>
      <MiniPlayer
        station={station}
        playbackState={playbackState}
        currentTime={currentTime}
        nowPlaying={nowPlaying[activeStationId] ?? { stationId: activeStationId, isLoading: false }}
        volume={volume}
        onPlay={playStation}
        onStop={stopPlayback}
        onVolumeChange={setVolume}
        onToggleMute={toggleMute}
        onOpenArtwork={setArtwork}
      />
      {artwork ? <ArtworkLightbox {...artwork} onDismiss={() => setArtwork(undefined)} /> : null}
    </>
  );
}
