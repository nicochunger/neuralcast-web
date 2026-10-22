import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { discoveryRequest } from "@/lib/discovery";

type Context = { params: Promise<{ station: string; action: string[] }> };
async function proxy(request: Request, context: Context) {
  const session = await getAuthSession();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { station, action } = await context.params;
  if (!["neuralcast", "neuralforge"].includes(station)) return NextResponse.json({ error: "Unknown station." }, { status: 404 });
  const media = action.length === 4 && action[0] === "batches" && ["audio", "artwork"].includes(action[2]) &&
    /^[a-z0-9][a-z0-9_-]{0,79}$/.test(action[1]) && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(action[3]);
  const allowed = (action.join("/") === "state" && request.method === "GET") ||
    (action.join("/") === "generate" && request.method === "POST") ||
    (action.join("/") === "feedback" && request.method === "PUT") ||
    (action.join("/") === "process" && request.method === "POST") ||
    (media && ["GET", "HEAD"].includes(request.method));
  if (!allowed) return NextResponse.json({ error: "Unknown operation." }, { status: 404 });
  if (["POST", "PUT"].includes(request.method) && request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") || 0) > 64000) return NextResponse.json({ error: "Feedback is too large." }, { status: 413 });
  try {
    const body = ["POST", "PUT"].includes(request.method) ? await request.text() : undefined;
    if (body && body.length > 64000) return NextResponse.json({ error: "Feedback is too large." }, { status: 413 });
    const headers = new Headers();
    if (body) headers.set("Content-Type", "application/json");
    for (const name of ["range", "if-range"]) if (media && request.headers.has(name)) headers.set(name, request.headers.get(name)!);
    const suffix = action[0] === "state" ? "" : `/${action.map(encodeURIComponent).join("/")}`;
    const upstream = await discoveryRequest(`${station}${suffix}`, { method: request.method, body, headers });
    if (media && (upstream.ok || upstream.status === 416)) {
      const resultHeaders = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      for (const name of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
        const value = upstream.headers.get(name); if (value) resultHeaders.set(name, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers: resultHeaders });
    }
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status, headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The discovery service could not be reached. Retry shortly." }, { status: 502 });
  }
}
export const GET = proxy;
export const HEAD = proxy;
export const POST = proxy;
export const PUT = proxy;
