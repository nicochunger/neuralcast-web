import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { formatEpisodeTitle, getEpisode, podcastFeedUrl } from "@/lib/episodes";
import { EpisodePage } from "@/components/EpisodePage";
import { cache } from "react";
export const dynamic = "force-dynamic";
const load = cache(getEpisode);
type Props = { params: Promise<{ station: string; episodeId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { station, episodeId } = await params;
  const episode = await load(station, episodeId);
  if (!episode) return { title: "Episode · NeuralCast" };
  const displayTitle = formatEpisodeTitle(episode);
  return { title: `${displayTitle} · NeuralCast`, description: episode.description, openGraph: { title: displayTitle, description: episode.description, type: "website" } };
}
export default async function Page({ params }: Props) {
  const { station, episodeId } = await params;
  const episode = await load(station, episodeId);
  if (!episode) notFound();
  return <EpisodePage episode={episode} rssUrl={podcastFeedUrl(episode.station)} />;
}
