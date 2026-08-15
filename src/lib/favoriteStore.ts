import { normalizeFavorites } from "@/lib/favorites";
import type { FavoriteTrack } from "@/types/radio";

interface HostAdminConfig {
  baseUrl: string;
  token: string;
}

export class FavoriteStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FavoriteStoreError";
  }
}

export function isFavoriteStoreConfigured(): boolean {
  return getHostAdminConfig() !== null;
}

export async function readAdminFavorites(): Promise<{ favorites: FavoriteTrack[]; exists: boolean }> {
  const payload = await requestHostAdmin("GET");
  return {
    favorites: normalizeFavorites(payload.favorites),
    exists: payload.exists === true
  };
}

export async function writeAdminFavorites(favorites: FavoriteTrack[]): Promise<void> {
  await requestHostAdmin("PUT", { favorites });
}

async function requestHostAdmin(method: "GET" | "PUT", body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const config = getHostAdminConfig();

  if (!config) {
    throw new FavoriteStoreError("The VPS favorites store is not configured.");
  }

  let response: Response;

  try {
    response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/admin/favorites`, {
      method,
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    });
  } catch {
    throw new FavoriteStoreError("The VPS favorites store could not be reached.");
  }

  if (!response.ok) {
    throw new FavoriteStoreError(getHostAdminFailureMessage(response.status));
  }

  const payload = (await response.json()) as unknown;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new FavoriteStoreError("The VPS favorites store returned an invalid response.");
  }

  return payload as Record<string, unknown>;
}

function getHostAdminFailureMessage(status: number): string {
  if (status === 401 || status === 403) {
    return "The VPS admin token was rejected; check HOST_ADMIN_TOKEN against the VPS token.";
  }

  if (status === 404) {
    return "The VPS favorites endpoint was not found; check HOST_ADMIN_BASE_URL and restart the NeuralCast admin API.";
  }

  if (status === 503) {
    return "The VPS admin API is not configured; check NEURALCAST_ADMIN_HTTP_TOKEN on the VPS.";
  }

  if (status >= 500) {
    return "The VPS favorites file could not be read or written.";
  }

  return `The VPS favorites endpoint returned HTTP ${status}.`;
}

function getHostAdminConfig(): HostAdminConfig | null {
  const baseUrl = process.env.HOST_ADMIN_BASE_URL?.trim();
  const token = process.env.HOST_ADMIN_TOKEN?.trim();

  return baseUrl && token ? { baseUrl, token } : null;
}
