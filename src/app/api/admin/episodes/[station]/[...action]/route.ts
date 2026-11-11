import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { episodeAdminRequest } from "@/lib/episodeAdmin";

type Context = { params: Promise<{ station: string; action: string[] }> };
const identifier = /^[a-z0-9][a-z0-9_-]{0,79}$/;
async function proxy(request: Request, context: Context) {
  const session = await getAuthSession();
  if (!session?.user?.isAdmin) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const { station, action } = await context.params;
  if (!["neuralcast", "neuralforge"].includes(station)) return NextResponse.json({ error: "Unknown station." }, { status: 404 });
  const cover=action.length===1&&action[0]==="cover"&&request.method==="GET";
  const audio = action.length === 3 && identifier.test(action[0]) && ((action[1] === "audio" && /^[a-f0-9]{64}$/.test(action[2])) || (action[1] === "recording" && identifier.test(action[2])));
  const history = action.length === 4 && identifier.test(action[0]) && action[1] === "history" &&
    ["editorial", "delivery", "revisions"].includes(action[2]) && /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(action[3]);
  const feedback = action.length === 2 && identifier.test(action[0]) && ["feedback", "review"].includes(action[1]);
  const allowed = (action.length === 1 && action[0] === "state" && request.method === "GET") ||
    (action.length === 1 && ["actions", "retry", "stop"].includes(action[0]) && request.method === "POST") ||
    (action.length === 1 && action[0] === "schedule" && request.method === "PUT") ||
    (feedback && request.method === "PUT") || (history && request.method === "GET") ||
    (audio && ["GET", "HEAD"].includes(request.method)) || cover;
  if (!allowed&&!cover) return NextResponse.json({ error: "Unknown operation." }, { status: 404 });
  if (["POST", "PUT"].includes(request.method) && request.headers.get("origin") !== new URL(request.url).origin)
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    if (Number(request.headers.get("content-length") || 0) > 256000) return NextResponse.json({ error: "Feedback is too large." }, { status: 413 });
    const body = ["POST", "PUT"].includes(request.method) ? await request.text() : undefined;
    if (body && Buffer.byteLength(body) > 256000) return NextResponse.json({ error: "Feedback is too large." }, { status: 413 });
    const headers = new Headers();
    if (body) headers.set("Content-Type", "application/json");
    if (audio) for (const key of ["range", "if-range"]) { const value = request.headers.get(key); if (value) headers.set(key, value); }
    let suffix = action[0] === "state" ? "" : `/${action.map(encodeURIComponent).join("/")}`;
    if (action[0] === "state") {
      const id = new URL(request.url).searchParams.get("episode_id");
      if (id && !identifier.test(id)) return NextResponse.json({ error: "Invalid episode." }, { status: 400 });
      if (id) suffix += `?episode_id=${encodeURIComponent(id)}`;
    }
    const upstream = await episodeAdminRequest(`${station}${suffix}`, { method: request.method, body, headers });
    if ((audio||cover) && (upstream.ok || upstream.status === 416)) {
      const output = new Headers({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
      for (const key of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
        const value = upstream.headers.get(key); if (value) output.set(key, value);
      }
      return new Response(upstream.body, { status: upstream.status, headers: output });
    }
    return NextResponse.json(await upstream.json().catch(() => ({})), { status: upstream.status, headers: { "Cache-Control": "private, no-store" } });
  } catch { return NextResponse.json({ error: "The episode service could not be reached. Retry shortly." }, { status: 502 }); }
}
export const GET = proxy; export const HEAD = proxy; export const POST = proxy; export const PUT = proxy;
