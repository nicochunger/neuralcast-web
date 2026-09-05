import type { HostMode, Station, StationHostChannel, StationId } from "@/types/radio";

export const AZURACAST_BASE_URL = "https://neuralcast.duckdns.org";

const neuralCastSpanish: StationHostChannel = {
  id: "neuralcast-es",
  locale: "es-AR",
  azuracastStationSlug: "neuralcast",
  streamUrl: `${AZURACAST_BASE_URL}/listen/neuralcast/radio.mp3`
};

const neuralForgeSpanish: StationHostChannel = {
  id: "neuralforge-es",
  locale: "es-AR",
  azuracastStationSlug: "neuralforge",
  streamUrl: `${AZURACAST_BASE_URL}/listen/neuralforge/radio.mp3`
};

const neuralForgeFrench: StationHostChannel = {
  id: "neuralforge-fr",
  locale: "fr-CH",
  azuracastStationSlug: "neuralforge_fr",
  streamUrl: `${AZURACAST_BASE_URL}/listen/neuralforge_fr/radio.mp3`
};

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
    hostChannels: [neuralCastSpanish],
    defaultHostChannelId: neuralCastSpanish.id,
    openRotationThreshold: 10
  },
  {
    id: "neuralforge",
    azuracastStationId: 2,
    name: "NeuralForge",
    streamUrl: neuralForgeSpanish.streamUrl,
    timeZone: "Europe/Zurich",
    backgroundImage: "/images/neuralforge-bg.webp",
    artworkImage: "/images/neuralforge-art.webp",
    accentColor: "#b55748",
    hostChannels: [neuralForgeSpanish, neuralForgeFrench],
    defaultHostChannelId: neuralForgeSpanish.id,
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

export function getHostChannel(
  station: Station,
  channelId: string | undefined
): StationHostChannel | undefined {
  return station.hostChannels.find((channel) => channel.id === channelId);
}

export function getDefaultHostChannel(station: Station): StationHostChannel {
  return (
    getHostChannel(station, station.defaultHostChannelId) ??
    station.hostChannels[0]
  );
}

function localeMatches(channelLocale: string, uiLocale: string): boolean {
  const channelLanguage = channelLocale.toLowerCase().split("-")[0];
  return channelLanguage === uiLocale.toLowerCase().split("-")[0];
}

export function resolveHostChannel(
  station: Station,
  mode: HostMode,
  fixedChannelId: string | undefined,
  uiLocale: string
): StationHostChannel {
  if (mode === "fixed") {
    const fixedChannel = getHostChannel(station, fixedChannelId);
    if (fixedChannel) return fixedChannel;
  }

  if (mode === "follow-ui") {
    const matchingChannel = station.hostChannels.find((channel) =>
      localeMatches(channel.locale, uiLocale)
    );
    if (matchingChannel) return matchingChannel;
  }

  return getDefaultHostChannel(station);
}
