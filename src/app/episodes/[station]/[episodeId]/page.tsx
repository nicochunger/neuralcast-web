import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getEpisode } from "@/lib/episodes";
import { EpisodePage } from "@/components/EpisodePage";
import { cache } from "react";
export const dynamic = "force-dynamic";
const load = cache(getEpisode);
type Props = { params: Promise<{ station: string; episodeId: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { station, episodeId } = await params;
  const episode = await load(station, episodeId);
  return episode ? { title: `${episode.title} · NeuralCast`, description: episode.description, openGraph: { title: episode.title, description: episode.description, type: "website" } } : { title: "Episode · NeuralCast" };
}
export default async function Page({ params }: Props) {
  const { station, episodeId } = await params;
  const episode = await load(station, episodeId);
  if (!episode) notFound();
  return <EpisodePage episode={episode} />;
}
