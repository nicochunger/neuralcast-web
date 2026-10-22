// Offline boundary checks for the real Next route, with auth/backend dependencies mocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
const filename = path.join(root, "src/app/api/admin/discovery/[station]/[...action]/route.ts");
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
let session = null;
let calls = [];
let backend = async () => Response.json({ batch: null });
const exportsObject = {};
vm.runInNewContext(source, {
  exports: exportsObject,
  require(name) {
    if (name === "next/server") return { NextResponse: { json: (value, init) => Response.json(value, init) } };
    if (name === "@/lib/auth") return { getAuthSession: async () => session };
    if (name === "@/lib/discovery") return { discoveryRequest: async (route, init) => { calls.push({ route, init }); return backend(); } };
    throw new Error(`Unexpected import: ${name}`);
  },
  Response, Request, Headers, URL, AbortSignal
}, { filename });
const context = (station = "neuralforge", action = ["state"]) => ({ params: Promise.resolve({ station, action }) });
const request = (method = "GET", headers = {}, body) => new Request("https://radio.example/api/admin/discovery/neuralforge/state", { method, headers, body });
(async () => {
  assert.equal((await exportsObject.GET(request(), context())).status, 401);
  session = { user: { isAdmin: false } };
  assert.equal((await exportsObject.GET(request(), context())).status, 401);
  session = { user: { isAdmin: true } };
  assert.equal((await exportsObject.GET(request(), context("unknown"))).status, 404);
  assert.equal((await exportsObject.GET(request(), context("neuralforge", ["arbitrary", "path"]))).status, 404);
  assert.equal(calls.length, 0);
  const noOrigin = await exportsObject.POST(request("POST"), context("neuralforge", ["generate"]));
  assert.equal(noOrigin.status, 403);
  const body = JSON.stringify({ batch_id: "batch-a", revision: 2, feedback: { "song-1": { accepted: false, reasoning: "Wrong performance, not a genre dislike." } } });
  const saved = await exportsObject.PUT(request("PUT", { Origin: "https://radio.example", "Content-Type": "application/json" }, body), context("neuralforge", ["feedback"]));
  assert.equal(saved.status, 200);
  assert.equal(calls[0].route, "neuralforge/feedback");
  assert.equal(calls[0].init.body, body);
  assert.equal(saved.headers.get("cache-control"), "private, no-store");
  backend = async () => new Response("audition", { status: 206, headers: { "Content-Type": "audio/mpeg", "Content-Range": "bytes 0-7/20", "Accept-Ranges": "bytes" } });
  const audioContext = context("neuralforge", ["batches", "batch-a", "audio", "song-1"]);
  const streamed = await exportsObject.GET(request("GET", { Range: "bytes=0-7" }), audioContext);
  assert.equal(streamed.status, 206);
  assert.equal(await streamed.text(), "audition");
  assert.equal(streamed.headers.get("content-range"), "bytes 0-7/20");
  assert.equal(streamed.headers.get("cache-control"), "private, no-store");
  assert.equal(calls.at(-1).init.headers.get("Range"), "bytes=0-7");
  const coverContext = context("neuralforge", ["batches", "batch-a", "artwork", "song-1"]);
  backend = async () => new Response("cover", { headers: { "Content-Type": "image/png", "Content-Length": "5" } });
  const cover = await exportsObject.GET(request(), coverContext);
  assert.equal(cover.status, 200);
  assert.equal(await cover.text(), "cover");
  assert.equal(cover.headers.get("content-type"), "image/png");
  assert.equal(cover.headers.get("cache-control"), "private, no-store");
  assert.equal(calls.at(-1).route, "neuralforge/batches/batch-a/artwork/song-1");
  backend = async () => new Response(null, { headers: { "Content-Type": "image/png", "Content-Length": "5" } });
  assert.equal((await exportsObject.HEAD(request("HEAD"), coverContext)).headers.get("content-length"), "5");
  session = null;
  assert.equal((await exportsObject.GET(request(), coverContext)).status, 401);
  assert.equal((await exportsObject.GET(request(), audioContext)).status, 401);
  session = { user: { isAdmin: true } };
  backend = async () => new Response(null, { status: 416, headers: { "Content-Range": "bytes */20" } });
  const outOfBounds = await exportsObject.GET(request("GET", { Range: "bytes=99-100" }), audioContext);
  assert.equal(outOfBounds.status, 416);
  assert.equal(outOfBounds.headers.get("content-range"), "bytes */20");
  backend = async () => { throw new Error("Private upstream authentication diagnostic"); };
  const failure = await exportsObject.GET(request(), context());
  assert.equal(failure.status, 502);
  assert.ok(!(await failure.text()).includes("authentication diagnostic"));
  console.log("Discovery proxy checks passed: auth, station/path allowlists, Origin, exact feedback, private ranges, safe errors.");
})().catch(error => { console.error(error); process.exitCode = 1; });
