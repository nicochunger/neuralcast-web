interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function getPartMap(date: Date, timeZone: string): Record<string, string> {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

function getZonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = getPartMap(date, timeZone);
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second)
  };
}

function zonedPartsAsUtcMillis(parts: ZonedParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function getZonedDateString(date: Date, timeZone: string): string {
  const parts = getZonedParts(date, timeZone);
  return [
    parts.year.toString().padStart(4, "0"),
    parts.month.toString().padStart(2, "0"),
    parts.day.toString().padStart(2, "0")
  ].join("-");
}

export function addDaysToDateString(dateString: string, days: number): string {
  const [year, month, day] = parseDateString(dateString);
  const nextDate = new Date(Date.UTC(year, month - 1, day + days));
  return [
    nextDate.getUTCFullYear().toString().padStart(4, "0"),
    (nextDate.getUTCMonth() + 1).toString().padStart(2, "0"),
    nextDate.getUTCDate().toString().padStart(2, "0")
  ].join("-");
}

export function isDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = parseDateString(value);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function startOfDayIsoOffset(dateString: string, timeZone: string): string {
  const utcMillis = zonedDateTimeToUtcMillis(dateString, timeZone);
  const offsetMinutes = getOffsetMinutes(utcMillis, timeZone);
  return `${dateString}T00:00:00${formatOffset(offsetMinutes)}`;
}

export function zonedDateTimeToUtcMillis(dateString: string, timeZone: string): number {
  const [year, month, day] = parseDateString(dateString);
  const targetUtcMillis = Date.UTC(year, month - 1, day, 0, 0, 0);
  let guess = targetUtcMillis;

  for (let iteration = 0; iteration < 3; iteration += 1) {
    const zonedGuess = zonedPartsAsUtcMillis(getZonedParts(new Date(guess), timeZone));
    guess -= zonedGuess - targetUtcMillis;
  }

  return guess;
}

function getOffsetMinutes(utcMillis: number, timeZone: string): number {
  const zonedUtcMillis = zonedPartsAsUtcMillis(getZonedParts(new Date(utcMillis), timeZone));
  return Math.round((zonedUtcMillis - utcMillis) / 60000);
}

function formatOffset(totalMinutes: number): string {
  const sign = totalMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(totalMinutes);
  const hours = Math.floor(absoluteMinutes / 60).toString().padStart(2, "0");
  const minutes = (absoluteMinutes % 60).toString().padStart(2, "0");
  return `${sign}${hours}:${minutes}`;
}

function parseDateString(value: string): [number, number, number] {
  return value.split("-").map(Number) as [number, number, number];
}
