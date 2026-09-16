import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Exercise the actual effect with virtual time and a changing backend response.
const source = readFileSync(new URL('../src/components/AdminConsole.tsx', import.meta.url), 'utf8');
const start = source.indexOf('    if (!isPollingJob || !activeJob?.jobId) return;');
const end = source.indexOf('\n  }, [activeJob?.jobId', start);
assert(start > 0 && end > start);
const effect = ts.transpile(`(() => {${source.slice(start, end)}\n})()`, { target: ts.ScriptTarget.ES2020 });
const timers = new Map();
const events = new Map();
const states = [];
let nextId = 0;
let calls = 0;
let failure = false;
let terminal = false;
let polling = true;
let error = null;
const context = {
  isPollingJob: true, activeJob: { jobId: 'test-job' }, POLL_INTERVAL_MS: 4000,
  AbortController, Date, Error,
  setTimeout(fn, delay) { const id = ++nextId; timers.set(id, { fn, delay }); return id; },
  clearTimeout(id) { timers.delete(id); },
  window: { addEventListener(name, fn) { events.set(name, fn); }, removeEventListener(name) { events.delete(name); } },
  document: { visibilityState: 'visible', addEventListener(name, fn) { events.set(name, fn); }, removeEventListener(name) { events.delete(name); } },
  async fetch() { calls++; if (failure) throw new Error('offline'); return { ok: true, json: async () => ({ jobId: 'test-job', status: terminal ? 'succeeded' : 'running', logTail: `line ${calls}` }) }; },
  isTerminalJobStatus: status => status === 'succeeded',
  setActiveJob: job => states.push(job), setPollError: value => { error = value; },
  setLastUpdated() {}, setIsPollingJob: value => { polling = value; }, setMessage() {}, buildJobStatusMessage() {}, t() {}
};
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const next = async () => { const [id, timer] = [...timers][0]; timers.delete(id); await timer.fn(); await settle(); };
const cleanup = vm.runInNewContext(effect, context);
await settle();
assert.equal(calls, 1);
await next(); await next();
assert.equal(calls, 3, 'polling must continue beyond the first refresh');
assert.equal(states.at(-1).logTail, 'line 3');
failure = true;
await next();
assert.match(error, /Retrying automatically/);
assert.equal(polling, true, 'transient failures must not end monitoring');
assert.equal([...timers.values()][0].delay, 8000);
failure = false;
await next();
assert.equal(error, null);
assert.equal([...timers.values()][0].delay, 4000);
events.get('online')(); await settle();
assert.equal(timers.size, 1, 'resume must not create parallel polling loops');
terminal = true;
await next();
assert.equal(polling, false);
assert.equal(timers.size, 0, 'terminal jobs must stop polling');
cleanup();
assert.equal(events.size, 0);
console.log('Admin polling regression checks passed.');
