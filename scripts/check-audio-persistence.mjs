import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const layoutPath = join(projectRoot, "src/app/layout.tsx");
const providerPath = join(projectRoot, "src/context/AudioPlayerContext.tsx");
const persistentAudioPath = join(projectRoot, "src/lib/persistentAudio.ts");
const serviceWorkerPath = join(projectRoot, "public/sw.js");

const layout = readFileSync(layoutPath, "utf8");
const provider = readFileSync(providerPath, "utf8");
const persistentAudio = readFileSync(persistentAudioPath, "utf8");
const serviceWorker = readFileSync(serviceWorkerPath, "utf8");

const audioMountIndex = layout.indexOf("<audio");
const clientProviderIndex = layout.indexOf("<LanguageProvider");

assert.ok(audioMountIndex >= 0, "RootLayout must render the persistent audio element.");
assert.ok(
  clientProviderIndex >= 0 && audioMountIndex < clientProviderIndex,
  "The persistent audio element must stay outside client providers and route content."
);
assert.match(
  layout,
  /<audio\s+[\s\S]*?id=\{PERSISTENT_AUDIO_ELEMENT_ID\}[\s\S]*?\/>/,
  "RootLayout must mount the shared audio element with its stable ID."
);
assert.match(
  provider,
  /getPersistentAudioElement\(\)/,
  "AudioPlayerProvider must control the root-mounted persistent audio element."
);
assert.doesNotMatch(
  provider,
  /\bnew\s+Audio\s*\(/,
  "AudioPlayerProvider must not create a route-owned audio element."
);
assert.doesNotMatch(
  provider,
  /appendChild\s*\(/,
  "AudioPlayerProvider must not move the persistent audio element into its client boundary."
);
assert.match(
  persistentAudio,
  /document\.getElementById\(PERSISTENT_AUDIO_ELEMENT_ID\)/,
  "The audio accessor must prefer the stable root-mounted element."
);

const serviceWorkerHandlers = new Map();
runInNewContext(serviceWorker, {
  URL,
  Response,
  caches: {
    match: () => Promise.resolve(undefined),
    open: () => Promise.resolve({
      addAll: () => Promise.resolve(),
      put: () => Promise.resolve()
    }),
    keys: () => Promise.resolve([]),
    delete: () => Promise.resolve(true)
  },
  fetch: () => Promise.resolve({
    ok: true,
    clone: () => ({})
  }),
  self: {
    location: { origin: "https://neuralcast.test" },
    clients: { claim: () => Promise.resolve() },
    skipWaiting: () => Promise.resolve(),
    addEventListener: (eventName, handler) => serviceWorkerHandlers.set(eventName, handler)
  }
});

const serviceWorkerFetch = serviceWorkerHandlers.get("fetch");
assert.equal(typeof serviceWorkerFetch, "function", "The service worker must register a fetch handler.");
assert.equal(
  serviceWorkerIntercepts({ path: "/about?_rsc=test", rsc: true }),
  false,
  "The service worker must never intercept Next.js RSC payloads."
);
assert.equal(
  serviceWorkerIntercepts({ path: "/about" }),
  false,
  "The service worker must not cache or intercept route data."
);
assert.equal(
  serviceWorkerIntercepts({ path: "/manifest.webmanifest" }),
  true,
  "The service worker should continue serving explicitly allowlisted static assets."
);
assert.equal(
  serviceWorkerIntercepts({ path: "/about", mode: "navigate" }),
  true,
  "Document navigation should retain the network-only offline response."
);

const internalHardNavigation = /<a\b[^>]*\bhref\s*=\s*(?:["']\/(?!\/)|\{["']\/(?!\/))/;
const sourceRoot = join(projectRoot, "src");
const hardNavigationFiles = listFiles(sourceRoot)
  .filter((path) => [".tsx", ".jsx"].includes(extname(path)))
  .filter((path) => internalHardNavigation.test(readFileSync(path, "utf8")))
  .map((path) => relative(projectRoot, path));

assert.deepEqual(
  hardNavigationFiles,
  [],
  `Internal routes must use next/link or the Next router to preserve audio; found hard navigation in: ${hardNavigationFiles.join(", ")}`
);

console.log("Audio persistence architecture check passed.");

function listFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listFiles(path) : [path];
  });
}

function serviceWorkerIntercepts({ path, mode = "cors", rsc = false }) {
  let intercepted = false;
  serviceWorkerFetch({
    request: {
      method: "GET",
      mode,
      url: new URL(path, "https://neuralcast.test").href,
      headers: new Headers(rsc ? { RSC: "1" } : {})
    },
    respondWith: () => {
      intercepted = true;
    }
  });
  return intercepted;
}
