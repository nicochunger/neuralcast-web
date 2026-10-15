import type { Metadata } from "next";
import { getEpisodes } from "@/lib/episodes";
import { EpisodesPage } from "@/components/EpisodesPage";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Episodes · NeuralCast", description: "Musical journeys with AI hosts from NeuralCast and NeuralForge." };
export default async function Page() {
  try { return <EpisodesPage episodes={await getEpisodes()} />; }
  catch { return <EpisodesPage episodes={[]} unavailable />; }
}
