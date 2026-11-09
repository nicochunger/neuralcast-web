import "server-only";
export async function episodeAdminRequest(path: string, init: RequestInit = {}) {
  const base = process.env.HOST_ADMIN_BASE_URL?.trim();
  const token = process.env.HOST_ADMIN_TOKEN?.trim();
  if (!base || !token) throw new Error("Episode service is not configured.");
  return fetch(`${base.replace(/\/+$/, "")}/admin/episodes/${path}`, {
    ...init, headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${token}` },
    cache: "no-store", signal: AbortSignal.timeout(20000)
  });
}
