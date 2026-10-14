"use client";

import { useEffect, useState } from "react";
import type { HostCompanion } from "@/types/hostCompanion";
import type { StationId } from "@/types/radio";

export interface CompanionChannel { stationId: StationId; channelId: string }

/** Keep availability independent of modal visibility and audio playback. */
export function useHostCompanions(channels: readonly CompanionChannel[]) {
  const [cards, setCards] = useState<Partial<Record<StationId, HostCompanion | null>>>({});
  const [now, setNow] = useState(() => Date.now() / 1000);

  useEffect(() => {
    const controller = new AbortController();
    const pending = new Set<StationId>();
    async function refresh({ stationId, channelId }: CompanionChannel) {
      if (pending.has(stationId)) return;
      pending.add(stationId);
      try {
        const response = await fetch(`/api/host-companion/${encodeURIComponent(stationId)}?channel=${encodeURIComponent(channelId)}`, {
          cache: "no-store", signal: controller.signal
        });
        if (!response.ok) throw new Error("Companion unavailable");
        const payload = await response.json() as { card: HostCompanion | null };
        if (!controller.signal.aborted) setCards((current) => ({
          ...current, [stationId]: payload.card?.channel === channelId ? payload.card : null
        }));
      } catch {
        if (!controller.signal.aborted) setCards((current) => ({ ...current, [stationId]: null }));
      } finally { pending.delete(stationId); }
    }
    const refreshAll = () => channels.forEach((channel) => void refresh(channel));
    refreshAll();
    const polling = window.setInterval(refreshAll, 15_000);
    const ticking = window.setInterval(() => setNow(Date.now() / 1000), 1_000);
    return () => { controller.abort(); window.clearInterval(polling); window.clearInterval(ticking); };
  }, [channels]);

  const visible: Partial<Record<StationId, HostCompanion>> = {};
  for (const { stationId, channelId } of channels) {
    const card = cards[stationId];
    if (card?.channel === channelId && card.expected_start <= now && card.expires_at > now) visible[stationId] = card;
  }
  return visible;
}
