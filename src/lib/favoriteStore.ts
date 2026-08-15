import { normalizeFavorites } from "@/lib/favorites";
import type { FavoriteTrack } from "@/types/radio";

interface HostAdminConfig {
  baseUrl: string;
  token: string;
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
    throw new Error("Host admin API is not configured.");
  }

  const response = await fetch(`${config.baseUrl.replace(/\/+$/, "")}/admin/favorites`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Favorites store request failed with ${response.status}.`);
  }

  const payload = (await response.json()) as unknown;
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Favorites store returned an invalid response.");
  }

  return payload as Record<string, unknown>;
}

function getHostAdminConfig(): HostAdminConfig | null {
  const baseUrl = process.env.HOST_ADMIN_BASE_URL?.trim();
  const token = process.env.HOST_ADMIN_TOKEN?.trim();

  return baseUrl && token ? { baseUrl, token } : null;
}
