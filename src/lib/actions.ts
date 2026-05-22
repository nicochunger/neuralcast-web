"use server";

import { getAuthSession } from "@/lib/auth";
import { skipCurrentTrack } from "@/lib/admin";
import { submitSongRequest } from "@/lib/songRequests";
import { getStation, isStationId } from "@/lib/stations";

export async function skipTrackAction(stationId: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const session = await getAuthSession();

    if (!session?.user?.isAdmin) {
      return { success: false, error: "Unauthorized." };
    }

    if (!isStationId(stationId)) {
      return { success: false, error: "Unknown station." };
    }

    const message = await skipCurrentTrack(stationId);
    return { success: true, message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to skip the current track."
    };
  }
}

export async function submitSongRequestAction(
  stationId: string,
  requestUrl: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (!isStationId(stationId)) {
      return { success: false, error: "Unknown station." };
    }

    const station = getStation(stationId);
    if (!station) {
      return { success: false, error: "Unknown station." };
    }

    if (!requestUrl) {
      return { success: false, error: "Select a song first." };
    }

    const message = await submitSongRequest(station, requestUrl);
    return { success: true, message };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to submit song request."
    };
  }
}
