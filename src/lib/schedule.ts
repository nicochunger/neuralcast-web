import {
  addDaysToDateString,
  getZonedDateString,
  isDateString,
  startOfDayIsoOffset,
  zonedDateTimeToUtcMillis
} from "@/lib/dateTime";
import { AZURACAST_BASE_URL } from "@/lib/stations";
import type { ScheduleSegment, ScheduleSegmentKind, Station, StationScheduleDay } from "@/types/radio";

interface RawScheduleEntry {
  title: string;
  startMillis: number;
  endMillis: number;
}

export async function fetchScheduleForDay(
  station: Station,
  requestedDate?: string
): Promise<StationScheduleDay> {
  const date = requestedDate ?? getZonedDateString(new Date(), station.timeZone);

  if (!isDateString(date)) {
    throw new Error("Schedule date must be YYYY-MM-DD.");
  }

  const endpoint = `${AZURACAST_BASE_URL}/api/station/${station.id}/schedule?rows=300&now=${encodeURIComponent(
    startOfDayIsoOffset(date, station.timeZone)
  )}`;

  const response = await fetch(endpoint, {
    cache: "no-store",
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`Schedule request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  return buildScheduleDay(station, date, parseScheduleEntries(payload));
}

export function buildScheduleDay(
  station: Station,
  date: string,
  entries: RawScheduleEntry[],
  nowMillis = Date.now()
): StationScheduleDay {
  const nextDate = addDaysToDateString(date, 1);
  const dayStartMillis = zonedDateTimeToUtcMillis(date, station.timeZone);
  const dayEndMillis = zonedDateTimeToUtcMillis(nextDate, station.timeZone);
  const segments = buildSegments(station, entries, dayStartMillis, dayEndMillis);
  const liveSegment = segments.find((segment) => {
    const start = Date.parse(segment.startTime);
    const end = Date.parse(segment.endTime);
    return start <= nowMillis && end > nowMillis;
  });
  const upNextSegment = segments.find((segment) => Date.parse(segment.startTime) > nowMillis);

  return {
    stationId: station.id,
    date,
    timeZone: station.timeZone,
    segments,
    liveSegment,
    upNextSegment,
    fetchedAt: new Date().toISOString()
  };
}

export function segmentTitle(segment?: ScheduleSegment): string {
  if (!segment) {
    return "Waiting for schedule.";
  }

  if (segment.kind === "open-slot") {
    return "Open slot";
  }

  if (segment.kind === "open-rotation") {
    return "Open rotation";
  }

  if (segment.playlistNames.length === 1) {
    return segment.playlistNames[0];
  }

  return `${segment.playlistNames.length} active playlists`;
}

export function segmentDetail(segment?: ScheduleSegment): string {
  if (!segment) {
    return "Schedule metadata is loading.";
  }

  if (segment.kind === "open-slot") {
    return "Nothing scheduled in this window.";
  }

  if (segment.kind === "open-rotation") {
    return "Broad mix from the active rotation.";
  }

  return segment.playlistNames.join(", ");
}

function parseScheduleEntries(payload: unknown): RawScheduleEntry[] {
  const entries = Array.isArray(payload)
    ? payload
    : isObject(payload) && Array.isArray(payload.data)
      ? payload.data
      : [];

  return entries.flatMap((entry) => {
    if (!isObject(entry)) {
      return [];
    }

    const title = firstNonEmpty(entry.title, entry.name, entry.description);
    const start = readDateMillis(entry.start);
    const end = readDateMillis(entry.end);

    if (!title || start === undefined || end === undefined || end <= start) {
      return [];
    }

    return [
      {
        title,
        startMillis: start,
        endMillis: end
      }
    ];
  });
}

function buildSegments(
  station: Station,
  entries: RawScheduleEntry[],
  dayStartMillis: number,
  dayEndMillis: number
): ScheduleSegment[] {
  const relevantEntries = entries.filter(
    (entry) => entry.endMillis > dayStartMillis && entry.startMillis < dayEndMillis
  );
  const boundaries = new Set<number>([dayStartMillis, dayEndMillis]);

  relevantEntries.forEach((entry) => {
    boundaries.add(Math.max(entry.startMillis, dayStartMillis));
    boundaries.add(Math.min(entry.endMillis, dayEndMillis));
  });

  const sortedBoundaries = [...boundaries].sort((left, right) => left - right);

  if (sortedBoundaries.length < 2) {
    return [
      {
        startTime: new Date(dayStartMillis).toISOString(),
        endTime: new Date(dayEndMillis).toISOString(),
        kind: "open-slot",
        playlistNames: []
      }
    ];
  }

  const rawSegments: ScheduleSegment[] = [];

  for (let index = 0; index < sortedBoundaries.length - 1; index += 1) {
    const startMillis = sortedBoundaries[index];
    const endMillis = sortedBoundaries[index + 1];

    if (endMillis <= startMillis) {
      continue;
    }

    const playlistNames = uniqueSorted(
      relevantEntries
        .filter((entry) => entry.startMillis < endMillis && entry.endMillis > startMillis)
        .map((entry) => entry.title)
    );
    const kind = getSegmentKind(station, playlistNames);

    rawSegments.push({
      startTime: new Date(startMillis).toISOString(),
      endTime: new Date(endMillis).toISOString(),
      kind,
      playlistNames
    });
  }

  return mergeAdjacentSegments(rawSegments);
}

function mergeAdjacentSegments(segments: ScheduleSegment[]): ScheduleSegment[] {
  return segments.reduce<ScheduleSegment[]>((merged, segment) => {
    const previous = merged.at(-1);
    const sameKind = previous?.kind === segment.kind;
    const sameNames = previous && previous.playlistNames.join("\n") === segment.playlistNames.join("\n");

    if (previous && previous.endTime === segment.startTime && sameKind && sameNames) {
      merged[merged.length - 1] = {
        ...previous,
        endTime: segment.endTime
      };
      return merged;
    }

    merged.push(segment);
    return merged;
  }, []);
}

function getSegmentKind(station: Station, playlistNames: string[]): ScheduleSegmentKind {
  if (playlistNames.length === 0) {
    return "open-slot";
  }

  if (station.openRotationThreshold && playlistNames.length >= station.openRotationThreshold) {
    return "open-rotation";
  }

  return "scheduled";
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function readDateMillis(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
