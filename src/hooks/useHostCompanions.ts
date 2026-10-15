"use client";

import { useEffect, useState } from "react";
import type { HostCompanion, PlaybackObservation } from "@/types/hostCompanion";
import type { StationId } from "@/types/radio";

export interface CompanionChannel { stationId: StationId; channelId: string; observations: PlaybackObservation[] }

/** Keep availability independent of modal visibility and audio playback. */
export function useHostCompanions(channels: readonly CompanionChannel[], currentTime: number) {
  const [cards, setCards] = useState<Partial<Record<StationId, HostCompanion | null>>>({});
  const now = currentTime / 1000;

  useEffect(() => {
    const controller = new AbortController();
    const pending = new Set<StationId>();
    async function refresh({ stationId, channelId, observations }: CompanionChannel) {
      if (pending.has(stationId)) return;
      pending.add(stationId);
      try {
        const response = await fetch(`/api/host-companion/${encodeURIComponent(stationId)}?channel=${encodeURIComponent(channelId)}&playback=${encodeURIComponent(JSON.stringify(observations))}`, {
          cache: "no-store", signal: controller.signal
        });
        if (!response.ok) throw new Error("Companion unavailable");
        const payload = await response.json() as { card: HostCompanion | null };
        if (!controller.signal.aborted) setCards((current) => {
          const incoming = payload.card?.channel === channelId ? payload.card : null;
          const previous = current[stationId];
          const retainEpisode = previous?.channel === channelId && previous.episode && !incoming?.episode &&
            (!incoming || incoming.expected_start < previous.expected_end);
          return { ...current, [stationId]: retainEpisode ? previous : incoming };
        });
      } catch {
        if (!controller.signal.aborted) setCards((current) => ({ ...current, [stationId]: null }));
      } finally { pending.delete(stationId); }
    }
    const refreshAll = () => channels.forEach((channel) => void refresh(channel));
    refreshAll();
    const polling = window.setInterval(refreshAll, 15_000);
    return () => { controller.abort(); window.clearInterval(polling); };
  }, [channels]);

  const visible: Partial<Record<StationId, HostCompanion>> = {};
  for (const { stationId, channelId } of channels) {
    const card = cards[stationId];
    if (card?.channel === channelId && card.expected_start <= now && card.expires_at > now) visible[stationId] = card;
  }
  return visible;
}
