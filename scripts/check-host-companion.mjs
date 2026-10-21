// Offline production-route check. Run after npm run build; no station requests.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

const now = Date.now() / 1000;
const card = {
  id: "offline-fixture", channel: "neuralforge-es", archetype: "concert_check",
  expected_start: now - 60, expected_end: now - 30, expires_at: now + 1170,
  transcript: "Un concert à Berne.",
  content: { title: "Un concert à découvrir", summary: "", key_points: [], items: [
    { artist: "Test Artist", venue: "Test Venue", city: "Bern", country: "CH", event_date: "2026-11-01", source_url: "https://example.com/event" }
  ] }
};
let calls = 0;
let backendPayload = { card };
let backendStatus = 200;
let receivedPlayback;
const backend = createServer((request, response) => {
  calls++;
  assert.equal(request.headers.authorization, "Bearer offline-test-token");
  const requested = new URL(request.url, "http://fixture");
  if (requested.pathname === "/admin/host-channels/neuralforge-es/episodes/42/art/music") {
    response.writeHead(200, { "Content-Type": "image/jpeg" });
    response.end(Buffer.from([255, 216, 255, 217]));
    return;
  }
  assert.equal(requested.pathname, "/admin/host-channels/neuralforge-es/companion");
  receivedPlayback = requested.searchParams.get("playback");
  response.writeHead(backendStatus, { "Content-Type": "application/json" });
  response.end(JSON.stringify(backendPayload));
});
backend.listen(0, "127.0.0.1");
await once(backend, "listening");
const backendPort = backend.address().port;
const portReservation = createServer();
portReservation.listen(0, "127.0.0.1");
await once(portReservation, "listening");
const webPort = portReservation.address().port;
await new Promise((resolve) => portReservation.close(resolve));
const app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(webPort)], {
  env: { ...process.env, HOST_ADMIN_BASE_URL: `http://127.0.0.1:${backendPort}`, HOST_ADMIN_TOKEN: "offline-test-token" },
  stdio: ["ignore", "ignore", "ignore"]
});
const base = `http://127.0.0.1:${webPort}`;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (app.exitCode !== null) throw new Error("Next server exited before becoming ready");
    try {
      await fetch(`${base}/api/host-companion/unknown`);
      ready = true;
      break;
    } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(ready, "Next server must start");
  const route = `${base}/api/host-companion/neuralforge?channel=neuralforge-es`;
  const valid = await fetch(route);
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.deepEqual(await valid.json(), { card });
  assert.equal(calls, 1);
  assert.equal((await fetch(`${base}/api/host-companion/neuralcast?channel=neuralforge-es`)).status, 404);
  assert.equal((await fetch(`${base}/api/host-companion/neuralforge?channel=unknown`)).status, 404);
  assert.equal((await fetch(`${base}/api/host-companion/neuralforge?channel=neuralforge-fr`)).status, 404);
  assert.equal((await fetch(`${base}/api/nowplaying/neuralforge?channel=neuralforge-fr`)).status, 404);
  assert.equal(calls, 1, "Invalid or paused channels must not reach the backend");
  backendPayload = { card: null };
  assert.deepEqual(await (await fetch(route)).json(), { card: null });
  backendPayload = { card: { ...card, channel: "neuralcast-es" } };
  assert.deepEqual(await (await fetch(route)).json(), { card: null });
  backendPayload = { card: { ...card, content: { title: "Invalid" } } };
  assert.deepEqual(await (await fetch(route)).json(), { card: null });
  backendStatus = 503;
  const failed = await fetch(route);
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { card: null });
  backendStatus = 200;
  const observations = [{ song_id: "episode-song", played_at: now - 60, current: true }];
  const episode = { ...card, id: "episode-42-start", archetype: "episode", expected_end: now + 240, expires_at: now + 1440,
    content: { title: "A musical journey", summary: "The episode premise", key_points: [], items: [] },
    episode: { media_id: "42", duration: 300, chapters: [
      { kind: "commentary", id: "opening", title: "Opening", summary: "Introduction", start: 0, end: 20, sources: [] },
      { kind: "music", id: "music", title: "Song", artist: "Artist", album: "Album", rationale: "Why it fits", start: 20, end: 280, art_url: "/api/episode-art/neuralforge-es/42/music" },
      { kind: "commentary", id: "closing", title: "Closing", summary: "Conclusion", start: 280, end: 300, key_points: [], sources: [] }
    ] }
  };
  backendPayload = { card: episode };
  const episodeRoute = `${route}&playback=${encodeURIComponent(JSON.stringify(observations))}`;
  assert.deepEqual(await (await fetch(episodeRoute)).json(), { card: episode });
  assert.deepEqual(JSON.parse(receivedPlayback), observations);
  backendPayload = { card: { ...episode, episode: { ...episode.episode, chapters: [{ ...episode.episode.chapters[0], start: -1 }] } } };
  assert.deepEqual(await (await fetch(episodeRoute)).json(), { card: null });
  backendPayload = { card: { ...episode, episode: { ...episode.episode, chapters: [{ ...episode.episode.chapters[1], art_url: "https://untrusted.example/image" }] } } };
  assert.deepEqual(await (await fetch(episodeRoute)).json(), { card: null });
  assert.equal((await fetch(`${route}&playback={}`)).status, 400);
  assert.equal((await fetch(`${base}/api/episode-art/unknown/42/music`)).status, 404);
  const artwork = await fetch(`${base}/api/episode-art/neuralforge-es/42/music`);
  assert.equal(artwork.status, 200);
  assert.equal(artwork.headers.get("content-type"), "image/jpeg");
  assert.equal((await artwork.arrayBuffer()).byteLength, 4);
  console.log("Host companion production-route checks passed (offline fixture).");
} finally {
  if (app.exitCode === null) { app.kill("SIGTERM"); await once(app, "exit"); }
  await new Promise((resolve) => backend.close(resolve));
}
