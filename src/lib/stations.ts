import type { Station, StationId } from "@/types/radio";

export const AZURACAST_BASE_URL = "https://neuralcast.duckdns.org";

export const STATIONS: readonly Station[] = [
  {
    id: "neuralcast",
    azuracastStationId: 1,
    name: "NeuralCast",
    streamUrl: `${AZURACAST_BASE_URL}/listen/neuralcast/radio.mp3`,
    timeZone: "Europe/Zurich",
    backgroundImage: "/images/neuralcast-bg.webp",
    artworkImage: "/images/neuralcast-art.webp",
    accentColor: "#1f8a78",
    openRotationThreshold: 10
  },
  {
    id: "neuralforge",
    azuracastStationId: 2,
    name: "NeuralForge",
    streamUrl: `${AZURACAST_BASE_URL}/listen/neuralforge/radio.mp3`,
    timeZone: "Europe/Zurich",
    backgroundImage: "/images/neuralforge-bg.webp",
    artworkImage: "/images/neuralforge-art.webp",
    accentColor: "#b55748",
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
