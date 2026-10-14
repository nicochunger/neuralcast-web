// Offline production-route check. Run after npm run build; no station requests.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";

const now = Date.now() / 1000;
const card = {
  id: "offline-fixture", channel: "neuralforge-fr", archetype: "concert_check",
  expected_start: now - 60, expected_end: now - 30, expires_at: now + 1170,
  transcript: "Un concert à Berne.",
  content: { title: "Un concert à découvrir", summary: "", key_points: [], items: [
    { artist: "Test Artist", venue: "Test Venue", city: "Bern", country: "CH", event_date: "2026-11-01", source_url: "https://example.com/event" }
  ] }
};
let calls = 0;
let backendPayload = { card };
let backendStatus = 200;
const backend = createServer((request, response) => {
  calls++;
  assert.equal(request.headers.authorization, "Bearer offline-test-token");
  assert.equal(request.url, "/admin/host-channels/neuralforge-fr/companion");
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
  const route = `${base}/api/host-companion/neuralforge?channel=neuralforge-fr`;
  const valid = await fetch(route);
  assert.equal(valid.status, 200);
  assert.equal(valid.headers.get("cache-control"), "no-store");
  assert.deepEqual(await valid.json(), { card });
  assert.equal(calls, 1);
  assert.equal((await fetch(`${base}/api/host-companion/neuralcast?channel=neuralforge-fr`)).status, 404);
  assert.equal((await fetch(`${base}/api/host-companion/neuralforge?channel=unknown`)).status, 404);
  assert.equal(calls, 1, "Invalid channels must not reach the backend");
  backendPayload = { card: null };
  assert.deepEqual(await (await fetch(route)).json(), { card: null });
  backendPayload = { card: { ...card, channel: "neuralforge-es" } };
  assert.deepEqual(await (await fetch(route)).json(), { card: null });
  backendPayload = { card: { ...card, content: { title: "Invalid" } } };
  assert.deepEqual(await (await fetch(route)).json(), { card: null });
  backendStatus = 503;
  const failed = await fetch(route);
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { card: null });
  console.log("Host companion production-route checks passed (offline fixture).");
} finally {
  app.kill("SIGTERM");
  await once(app, "exit");
  await new Promise((resolve) => backend.close(resolve));
}
