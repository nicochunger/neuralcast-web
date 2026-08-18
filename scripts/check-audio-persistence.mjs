import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const layoutPath = join(projectRoot, "src/app/layout.tsx");
const providerPath = join(projectRoot, "src/context/AudioPlayerContext.tsx");
const persistentAudioPath = join(projectRoot, "src/lib/persistentAudio.ts");

const layout = readFileSync(layoutPath, "utf8");
const provider = readFileSync(providerPath, "utf8");
const persistentAudio = readFileSync(persistentAudioPath, "utf8");

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
