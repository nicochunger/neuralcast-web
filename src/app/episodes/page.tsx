import type { Metadata } from "next";
import { getEpisodes, podcastFeedUrl } from "@/lib/episodes";
import { isStationId } from "@/lib/stations";
import { EpisodesPage } from "@/components/EpisodesPage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Podcasts · NeuralCast", description: "Independent podcasts from NeuralCast and NeuralForge: musical journeys with AI hosts." };

type Props = { searchParams: Promise<{ station?: string }> };
export default async function Page({ searchParams }: Props) {
  const { station } = await searchParams;
  const requested = station && isStationId(station) ? station : undefined;
  try {
    const episodes = await getEpisodes();
    const stationId = requested ?? episodes[0]?.station ?? "neuralforge";
    return <EpisodesPage episodes={episodes} stationId={stationId} rssUrl={podcastFeedUrl(stationId)} />;
  } catch {
    const stationId = requested ?? "neuralforge";
    return <EpisodesPage episodes={[]} stationId={stationId} rssUrl={podcastFeedUrl(stationId)} unavailable />;
  }
}
