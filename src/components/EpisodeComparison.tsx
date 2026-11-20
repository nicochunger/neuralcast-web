"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AdminEpisodes.module.css";

type Source = { url: string; claim: string };
type Segment = { id: string; kind: string; artist?: string; title?: string; script?: string; companion?: { title: string }; sources?: Source[] };
type Version = {
  id: string; label: string; status: string; failure?: string; manuscript_hash: string | null;
  segments: Segment[]; draft_segments: Segment[]; research_notes: string;
  blockers: string[]; findings: { id?: string; problem?: string; correction?: string; severity?: string }[];
  changes: { segment_id: string; explanation: string }[];
  production_notes: string[]; listening_notes: { note: string }[];
  timing?: { spoken_words: number; estimated_total_seconds: number };
  metrics: Record<string, { provider: string; model: string; elapsed_seconds: number; usage: unknown }>;
  elapsed_seconds: number; attempts: number;
  audio: null | { revision: string; duration: number; chapters: { id: string; title: string; start: number }[] };
};
type Comparison = { id: string; current_concept: boolean; versions: Version[]; pipelines: Record<string, string> };
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function VersionReview({ version: v, base, episodeId, comparisonId, disabled, revealed, onRender, onResolve }: {
  version: Version; base: string; episodeId: string; comparisonId: string; disabled: boolean; revealed: boolean;
  onRender: () => void; onResolve: () => void;
}) {
  const [draft, setDraft] = useState(false);
  const player = useRef<HTMLAudioElement>(null);
  const showDraft = draft || !v.segments.length;
  const segments = showDraft ? v.draft_segments : v.segments;
  useEffect(() => { const audio = player.current; return () => { audio?.pause(); }; }, [comparisonId, v.audio?.revision]);
  return <article className={styles.comparisonVersion} aria-label={v.label}>
    <h5>{v.label}</h5><p>{v.status.replaceAll("_", " ")}</p>
    {v.failure && <p role="alert">{v.failure}</p>}
    {v.timing && <p>{v.timing.spoken_words} words · estimated {time(v.timing.estimated_total_seconds)}</p>}
    <p>{v.attempts} attempts · {time(v.elapsed_seconds)} total model time (parallel stages overlap)</p>
    {!!v.blockers.length && <div role="alert"><strong>The agent needs to resolve these questions</strong><p>It can qualify conflicting accounts or remove unsupported claims. You do not need to research them yourself.</p><button disabled={disabled || !v.manuscript_hash} onClick={onResolve}>Resolve research questions</button><ul>{v.blockers.map((b, i) => <li key={i}>{b}</li>)}</ul></div>}
    {v.audio ? <div><audio ref={player} controls preload="none" src={`${base}/${episodeId}/comparisons/${comparisonId}/${v.id}/audio/${v.audio.revision}`} aria-label={`${v.label} comparison audio`} /><p>Local listening copy · {time(v.audio.duration)}</p><div className={styles.chapters}>{v.audio.chapters.map(chapter => <button key={chapter.id} onClick={() => { if (player.current) { player.current.currentTime = chapter.start; void player.current.play(); } }}>{time(chapter.start)} · {chapter.title}</button>)}</div></div> : <button disabled={disabled || !v.manuscript_hash || !!v.blockers.length} onClick={onRender}>Approve {v.label.toLowerCase()} manuscript & generate audio</button>}
    {(!!v.segments.length || !!v.draft_segments.length) && <>
      <label className={styles.check}><input type="checkbox" checked={showDraft} disabled={!v.segments.length} onChange={e => setDraft(e.target.checked)} />Read initial draft before reviews</label>
      <details><summary>{showDraft ? "Initial draft" : "Final manuscript"}</summary>{segments.map(s => s.kind === "music" ? <p className={styles.song} key={s.id}>♫ {s.artist} — {s.title}</p> : <section key={s.id}><h6>{s.companion?.title || s.id}</h6><p className={styles.script}>{s.script}</p>{!!s.sources?.length && <details><summary>Evidence</summary><ul>{s.sources.map((source, i) => <li key={i}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.claim}</a></li>)}</ul></details>}</section>)}</details>
      <details><summary>Research, findings and editorial changes</summary><p className={styles.script}>{v.research_notes}</p><ul>{v.findings.map((f, i) => <li key={i}>{f.severity}: {f.problem} {f.correction}</li>)}</ul><ul>{v.changes.map((c, i) => <li key={i}>{c.segment_id}: {c.explanation}</li>)}</ul><ul>{v.production_notes.map((n, i) => <li key={i}>{n}</li>)}{v.listening_notes.map((n, i) => <li key={`listen-${i}`}>{n.note}</li>)}</ul></details>
    </>}
    {revealed && <details><summary>Provider usage and attempt metrics</summary><p>Token counts are provider-specific. Monetary cost is not estimated from Codex subscription usage.</p><pre className={styles.log}>{JSON.stringify(v.metrics, null, 2)}</pre></details>}
  </article>;
}

export function EpisodeComparison({ base, episode, disabled, onAction }: {
  base: string;
  episode: { id: string; status: string; comparisons?: { id: string }[]; concept_approved: boolean };
  disabled: boolean;
  onAction: (action: string, extra?: Record<string, unknown>) => void;
}) {
  const experiments = episode.comparisons ?? [];
  const [selected, setSelected] = useState("");
  const latestSeen = useRef("");
  const [result, setResult] = useState<Comparison | null>(null);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    const latest = experiments[0]?.id;
    if (latest && latest !== latestSeen.current) { latestSeen.current = latest; setSelected(latest); setRevealed(false); }
  }, [experiments]);
  useEffect(() => {
    if (!selected) return;
    let stopped = false; const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`${base}/${episode.id}/comparisons/${selected}`, { cache: "no-store", signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to load comparison");
        if (!stopped) { setResult(data); setError(""); }
      } catch (e) { if (!stopped) setError(e instanceof Error ? e.message : "Unable to load comparison"); }
    }
    setResult(null); void load(); const timer = setInterval(() => void load(), 5000);
    return () => { stopped = true; controller.abort(); clearInterval(timer); };
  }, [base, episode.id, selected]);
  return <section id="episode-comparison" tabIndex={-1} className={styles.comparison} aria-label="Pipeline comparison">
    <h4>Compare episode pipelines</h4>
    <p>Generate two independent episodes from this brief: the current Codex + Gemini workflow and a Gemini-only workflow. Both use the same frozen brief, candidate recordings, host guidance and voice settings. Each version needs your manuscript approval before audio generation.</p>
    <p>Results stay separate from your working episode. Audio stays private in this panel. Song selection follows the approved brief; fix its songs and order for a closer writing comparison.</p>
    {episode.status !== "published" && <button disabled={disabled} onClick={() => { setSelected(""); setRevealed(false); onAction("compare"); }}>{episode.concept_approved ? "Generate both comparison versions" : "Approve brief & generate both comparison versions"}</button>}
    {!!experiments.length && <label>Saved comparison<select value={selected} onChange={e => { setSelected(e.target.value); setRevealed(false); }}>{experiments.map((x, i) => <option key={x.id} value={x.id}>Comparison {experiments.length - i} · {x.id.slice(0, 8)}</option>)}</select></label>}
    {error && <p role="alert">{error}</p>}
    {result && <>
      {!result.current_concept && <p>This comparison uses an earlier brief snapshot.</p>}
      <p>Compare the drafts as well as the final edit. Review factual support, story development, voice, transitions and unresolved questions. One paired run is exploratory; repeat with other proposals before choosing a default.</p>
      <button onClick={() => setRevealed(v => !v)}>{revealed ? "Hide pipeline identities" : "Reveal pipeline identities"}</button>
      {revealed && <p>{result.versions.map(v => `${v.label}: ${result.pipelines[v.id] === "hybrid" ? "Codex research/draft and facts, Gemini reviews/edit" : "Gemini Neon for every editorial stage"}. `).join("")}Both use the same speech model.</p>}
      <div className={styles.comparisonGrid}>{result.versions.map(v => <VersionReview key={`${result.id}:${v.id}`} version={v} base={base} episodeId={episode.id} comparisonId={result.id} disabled={disabled || episode.status === "published"} revealed={revealed} onResolve={() => onAction("compare_resolve", { comparison_id: result.id, variant: v.id, comparison_manuscript_hash: v.manuscript_hash })} onRender={() => onAction("compare_render", { comparison_id: result.id, variant: v.id, comparison_manuscript_hash: v.manuscript_hash })} />)}</div>
    </>}
  </section>;
}
