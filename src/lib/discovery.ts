import "server-only";

/** Server-only credentials; callers must authenticate the admin session first. */
export async function discoveryRequest(path: string, init: RequestInit = {}) {
  const base = process.env.HOST_ADMIN_BASE_URL?.trim();
  const token = process.env.HOST_ADMIN_TOKEN?.trim();
  if (!base || !token) throw new Error("The station admin service is not configured.");
  return fetch(`${base.replace(/\/+$/, "")}/admin/discovery/${path}`, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${token}` },
    cache: "no-store", signal: AbortSignal.timeout(15000)
  });
}
