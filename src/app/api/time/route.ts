import { AZURACAST_BASE_URL } from "@/lib/stations";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch(`${AZURACAST_BASE_URL}/api/time`, {
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Time request failed with ${response.status}.`);
    }

    const payload = (await response.json()) as unknown;
    const timestamp = readTimestamp(payload);

    if (timestamp === undefined) {
      throw new Error("Time response did not include a valid timestamp.");
    }

    return NextResponse.json(
      { timestamp },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to synchronize server time.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

function readTimestamp(value: unknown): number | undefined {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const timestamp = (value as Record<string, unknown>).timestamp;

    if (typeof timestamp === "number" && Number.isFinite(timestamp)) {
      return timestamp;
    }

    if (typeof timestamp === "string") {
      const parsed = Number(timestamp);
      return Number.isFinite(parsed) ? parsed : undefined;
    }
  }

  return undefined;
}
