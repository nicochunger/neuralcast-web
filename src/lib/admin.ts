import { AZURACAST_BASE_URL, getStation } from "@/lib/stations";
import type { Station, StationId } from "@/types/radio";

interface SkipAttempt {
  method: "POST" | "PUT";
  path: string;
  jsonBody?: string;
  treatUriOnlyAsPreview?: boolean;
}

interface RequestResult {
  ok: boolean;
  body: string;
}

export async function skipCurrentTrack(stationId: StationId) {
  const station = getStation(stationId);

  if (!station) {
    throw new Error("Unknown station.");
  }

  const apiKey = process.env.AZURACAST_ADMIN_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("AzuraCast admin API key is not configured.");
  }

  const fallbackMessage = "Unable to skip the current track.";
  let lastErrorMessage = fallbackMessage;

  for (const attempt of buildSkipAttempts(station)) {
    const result = await executeSkipAttempt(attempt, apiKey);

    if (!result.ok) {
      lastErrorMessage = buildErrorMessage(result.body, fallbackMessage);
      continue;
    }

    try {
      const message = parseSuccessMessage(
        result.body,
        `Skipped current track on ${station.name}.`,
        attempt.treatUriOnlyAsPreview ?? false
      );

      if (message === null) {
        lastErrorMessage = "The server accepted a debug next-song call, but did not confirm a force skip.";
        continue;
      }

      return message;
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : fallbackMessage;
    }
  }

  throw new Error(lastErrorMessage);
}

function buildSkipAttempts(station: Station): SkipAttempt[] {
  return [
    { method: "POST", path: `/api/station/${station.id}/backend/skip` },
    { method: "PUT", path: `/api/admin/debug/station/${station.id}/telnet?command=radio.skip` },
    { method: "PUT", path: `/api/admin/debug/station/${station.id}/telnet?command=skip` },
    {
      method: "PUT",
      path: `/api/admin/debug/station/${station.id}/telnet`,
      jsonBody: JSON.stringify({ command: "radio.skip" })
    },
    {
      method: "PUT",
      path: `/api/admin/debug/station/${station.id}/telnet`,
      jsonBody: JSON.stringify({ command: "skip" })
    },
    {
      method: "PUT",
      path: `/api/admin/debug/station/${station.id}/nextsong`,
      treatUriOnlyAsPreview: true
    }
  ];
}

async function executeSkipAttempt(attempt: SkipAttempt, apiKey: string): Promise<RequestResult> {
  const response = await fetch(`${AZURACAST_BASE_URL}${attempt.path}`, {
    method: attempt.method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": attempt.jsonBody ? "application/json" : "text/plain",
      "X-API-Key": apiKey
    },
    body: attempt.jsonBody,
    cache: "no-store"
  });

  return {
    ok: response.ok,
    body: await response.text()
  };
}

function parseSuccessMessage(rawBody: string, fallback: string, treatUriOnlyAsPreview = false): string | null {
  if (!rawBody.trim()) {
    return fallback;
  }

  const parsed = tryParseJson(rawBody);

  if (parsed) {
    const successValue = parsed.success;
    const isSuccess =
      typeof successValue === "boolean"
        ? successValue
        : typeof successValue === "string"
          ? successValue.toLowerCase() === "true"
          : true;
    const message = pickMessage(parsed);
    const uri = typeof parsed.uri === "string" ? parsed.uri : "";

    if (!isSuccess) {
      throw new Error(message || fallback);
    }

    if (treatUriOnlyAsPreview && !message && uri) {
      return null;
    }

    return message || fallback;
  }

  return normalizePlainTextMessage(rawBody) || fallback;
}

function buildErrorMessage(rawBody: string, fallback: string) {
  if (!rawBody.trim()) {
    return fallback;
  }

  const parsed = tryParseJson(rawBody);
  return parsed ? pickMessage(parsed) || fallback : normalizePlainTextMessage(rawBody) || fallback;
}

function normalizePlainTextMessage(rawBody: string) {
  const firstLine = rawBody.split("\n", 1)[0] ?? "";
  return firstLine
    .replace(/^Error:\s*/i, "")
    .split(" on /", 1)[0]
    .trim();
}

function pickMessage(payload: Record<string, unknown>) {
  const formattedMessage = typeof payload.formatted_message === "string" ? payload.formatted_message.trim() : "";
  const message = typeof payload.message === "string" ? payload.message.trim() : "";
  return formattedMessage || message;
}

function tryParseJson(rawBody: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}
