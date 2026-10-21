import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const exports = {};
const source = readFileSync(new URL("../src/lib/stations.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
});
runInNewContext(outputText, { exports });
const station = exports.getStation("neuralforge");
assert.deepEqual(Array.from(station.hostChannels, channel => channel.id), ["neuralforge-es"]);
assert.equal(exports.getHostChannel(station, "neuralforge-fr"), undefined);
assert.equal(exports.resolveHostChannel(station, "fixed", "neuralforge-fr", "fr").id, "neuralforge-es");
assert.equal(exports.resolveHostChannel(station, "follow-ui", undefined, "fr").id, "neuralforge-es");
assert.ok(exports.PAUSED_HOST_CHANNELS.some(channel => channel.id === "neuralforge-fr"));
console.log("Paused host choices and saved-preference fallback checks passed.");
