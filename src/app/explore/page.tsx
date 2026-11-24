import type { Metadata } from "next";
import { SonicAtlasPage } from "@/components/SonicAtlasPage";
import { getStationAtlas } from "@/lib/atlas";
import { DEFAULT_STATION_ID, isStationId } from "@/lib/stations";
import type { AtlasErrorCode, StationAtlasPayload } from "@/types/atlas";
import type { StationId } from "@/types/radio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sonic Atlas · NeuralCast",
  description:
    "Explore the musical DNA of NeuralCast and NeuralForge: interactive playlist constellations, decade timelines, and full station archives."
};

type Props = {
  searchParams: Promise<{ station?: string }>;
};

export default async function Page({ searchParams }: Props) {
  const { station } = await searchParams;
  const stationId: StationId = station && isStationId(station) ? station : DEFAULT_STATION_ID;

  let initialAtlas: StationAtlasPayload | null = null;
  let initialErrorCode: AtlasErrorCode | null = null;

  try {
    const result = await getStationAtlas(stationId);
    initialAtlas = result.data;
    initialErrorCode = result.errorCode;
  } catch {
    initialAtlas = null;
    initialErrorCode = "unavailable";
  }

  return (
    <SonicAtlasPage
      initialStation={stationId}
      initialAtlas={initialAtlas}
      initialErrorCode={initialErrorCode}
    />
  );
}
