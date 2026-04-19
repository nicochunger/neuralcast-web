import type { Station, StationId } from "@/types/radio";

export const AZURACAST_BASE_URL = "https://neuralcast.duckdns.org";

export const STATIONS: readonly Station[] = [
  {
    id: "neuralcast",
    name: "NeuralCast",
    streamUrl: `${AZURACAST_BASE_URL}/listen/neuralcast/radio.mp3`,
    timeZone: "Europe/Zurich",
    backgroundImage: "/images/neuralcast-bg.webp",
    artworkImage: "/images/neuralcast-art.webp",
    accentColor: "#29d9bb"
  },
  {
    id: "neuralforge",
    name: "NeuralForge",
    streamUrl: `${AZURACAST_BASE_URL}/listen/neuralforge/radio.mp3`,
    timeZone: "Europe/Zurich",
    backgroundImage: "/images/neuralforge-bg.webp",
    artworkImage: "/images/neuralforge-art.webp",
    accentColor: "#ff493d",
    openRotationThreshold: 10
  }
];

export const DEFAULT_STATION_ID: StationId = "neuralcast";

export function isStationId(value: string): value is StationId {
  return STATIONS.some((station) => station.id === value);
}

export function getStation(stationId: string): Station | undefined {
  return STATIONS.find((station) => station.id === stationId);
}
