"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AdminDiscovery.module.css";

type Feedback = { accepted: boolean; reasoning: string };
type Candidate = { id: string; artist: string; title: string; album: string; year: string; playlist: string; rationale: string; uncertainty: string; research_urls: string[] };
type Batch = { id: string; status: "preparing" | "review" | "submitted" | "processed"; candidates: Candidate[]; auditions: Record<string, unknown>; feedback: Record<string, Feedback>; revision: number; error: string | null; promoted: string[]; editorial: { placements: { candidate_id: string; playlist: string }[]; preference_updates: { text: string; scope: string }[] } | null };
type Job = { job_id: string; status: string; log_tail?: string };
type View = { station: string; batch: Batch | null; job?: Job | null };
const errorMessage = (p: { error?: unknown; detail?: unknown }) => typeof p.error === "string" ? p.error : typeof p.detail === "string" ? p.detail : "The request failed. Reload and try again.";

export function AdminDiscovery() {
  const [station, setStation] = useState("neuralforge");
  const [view, setView] = useState<View | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback>>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [reload, setReload] = useState(0);
  const dirtyRef = useRef(false);
  const revisionRef = useRef<string | null>(null);
  const players = useRef<HTMLDivElement | null>(null);
  const base = `/api/admin/discovery/${station}`;
  const batch = view?.batch;
  const running = job?.status === "running" || job?.status === "accepted";
  const editable = batch?.status === "review" && !busy && !running;
  const complete = batch?.candidates.length === 5 && batch.candidates.every(c => feedback[c.id]);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let failures = 0;
    async function refresh() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20000);
      try {
        const response = await fetch(`${base}/state`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(errorMessage(payload));
        if (stopped) return;
        const result = payload as View;
        const key = result.batch ? `${result.batch.id}:${result.batch.revision}` : "empty";
        if (dirtyRef.current && revisionRef.current !== key) {
          setError("This review changed in another session. Copy any unsaved reasoning, then reload this review.");
          return; // Keep the old revision so a stale save also fails on the server.
        }
        if (!dirtyRef.current && revisionRef.current !== key) {
          setFeedback(result.batch?.feedback ?? {}); revisionRef.current = key;
        }
        failures = 0; setView(result); setJob(result.job ?? null); setError(null);
      } catch (cause) {
        if (!stopped) { failures++; setError(cause instanceof Error ? cause.message : "Connection interrupted."); }
      } finally {
        clearTimeout(timeout);
        if (!stopped) { setLoading(false); timer = setTimeout(refresh, Math.min(5000 * 2 ** failures, 30000)); }
      }
    }
    void refresh();
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [base, reload]);

  useEffect(() => {
    const audioPlayers = Array.from(players.current?.querySelectorAll("audio") ?? []);
    return () => audioPlayers.forEach(audio => audio.pause());
  }, [station, batch?.id, batch?.status]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirtyRef.current) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  function edit(id: string, value: Feedback) {
    setFeedback(current => ({ ...current, [id]: value }));
    setDirty(true); dirtyRef.current = true; setNotice(null);
  }
  async function request(action: string, method: string, payload?: unknown) {
    const response = await fetch(`${base}/${action}`, {
      method, headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined, signal: AbortSignal.timeout(20000)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(errorMessage(result));
    return result;
  }
  async function run(action: "save" | "process" | "generate") {
    setBusy(true); setError(null); setNotice(null);
    try {
      let revision = batch?.revision ?? 0;
      if (action !== "generate" && batch?.status === "review") {
        const saved = await request("feedback", "PUT", { batch_id: batch.id, revision, feedback });
        revision = saved.batch.revision; revisionRef.current = `${batch.id}:${revision}`;
        setView(current => current ? { ...current, batch: saved.batch } : current);
        dirtyRef.current = false; setDirty(false);
      }
      if (action === "process" && batch) {
        const result = await request("process", "POST", { batch_id: batch.id, revision });
        if (result.job_id) setJob({ job_id: result.job_id, status: "running" });
        setNotice("Feedback submitted. Only accepted songs will be added; no new search will run.");
      } else if (action === "generate") {
        const result = await request("generate", "POST");
        setJob({ job_id: result.job_id, status: "running" });
        setNotice("Preparing five suggestions. You can leave and return later.");
      } else setNotice("Feedback saved. You can finish reviewing later.");
      setReload(current => current + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Operation failed."); }
    finally { setBusy(false); }
  }

  return <section className={`adminPanel ${styles.panel}`} aria-label="Music discovery">
    <div className={styles.toolbar}><label>Station<select value={station} disabled={busy || dirty} onChange={event => {
      players.current?.querySelectorAll("audio").forEach(audio => audio.pause()); setStation(event.target.value); setView(null);
      setFeedback({}); setJob(null); setLoading(true); setNotice(null); setError(null); revisionRef.current = null;
    }}><option value="neuralforge">NeuralForge</option><option value="neuralcast">NeuralCast</option></select></label>
      <button type="button" disabled={busy || loading || running || dirty || batch?.status === "review" || batch?.status === "submitted"}
        onClick={() => void run("generate")}>{batch?.status === "preparing" ? "Retry preparation" : "Generate suggestions"}</button>
    </div>
    <p>Listen privately, choose Yes or No, and explain what worked or missed. Weekly suggestions pause until this batch is processed.</p>
    {loading && <p role="status">Loading your listening room…</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {job && <p role="status">{running ? "Working in the background…" : `Latest job: ${job.status}`}</p>}
    {batch?.error && <p role="alert" className={styles.error}>{batch.error}</p>}
    {!loading && !batch && <p>No suggestions yet. Generate your first five to start.</p>}
    {batch?.status === "preparing" && <p>Preparing recordings. Feedback opens when all five are ready.</p>}
    {batch?.status === "submitted" && <p>Feedback is frozen. If processing failed, retry below to resume without duplicates.</p>}
    {batch?.status === "processed" && <p>Review complete: {batch.promoted.length} accepted song(s) added. Audition copies have been removed.</p>}
    <div className={styles.cards} ref={players}>{batch?.candidates.map(candidate => {
      const entry = feedback[candidate.id];
      const available = candidate.id in batch.auditions && batch.status !== "processed";
      const playlist = batch.editorial?.placements.find(p => p.candidate_id === candidate.id)?.playlist ?? candidate.playlist;
      return <article className={styles.card} key={candidate.id}>
        <div><span className={styles.playlist}>{playlist}</span><h3>{candidate.title}</h3><p>{candidate.artist} · {candidate.album} · {candidate.year}</p></div>
        <p>{candidate.rationale}</p>
        {candidate.uncertainty && <p className={styles.muted}>Worth checking: {candidate.uncertainty}</p>}
        {available && <audio controls preload="none" aria-label={`Audition ${candidate.artist} — ${candidate.title}`}
          src={`${base}/batches/${batch.id}/audio/${candidate.id}`}
          onPlay={event => players.current?.querySelectorAll("audio").forEach(audio => { if (audio !== event.currentTarget) audio.pause(); })} />}
        <fieldset disabled={!editable}><legend>Add this song?</legend><div className={styles.decisions}>
          {[true, false].map(accepted => <label key={String(accepted)}><input type="radio" name={`decision-${candidate.id}`}
            checked={entry?.accepted === accepted} onChange={() => edit(candidate.id, { accepted, reasoning: entry?.reasoning ?? "" })} />{accepted ? "Yes" : "No"}</label>)}
        </div><label>Your reasoning<textarea rows={3} maxLength={4000} value={entry?.reasoning ?? ""}
          placeholder="What did you enjoy, or why did it miss? Optional."
          disabled={!editable || !entry} onChange={event => entry && edit(candidate.id, { ...entry, reasoning: event.target.value })} /></label></fieldset>
        <details><summary>Research sources</summary><ul>{candidate.research_urls.filter(url => /^https?:\/\//i.test(url)).map(url => <li key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></li>)}</ul></details>
      </article>;
    })}</div>
    {batch && ["review", "submitted"].includes(batch.status) && <div className={styles.actions}>
      {batch.status === "review" && <button type="button" disabled={!editable || !dirty} onClick={() => void run("save")}>Save feedback</button>}
      <button type="button" disabled={busy || running || (batch.status === "review" && !complete)} onClick={() => void run("process")}>
        {batch.status === "submitted" ? "Retry processing" : "Process feedback"}</button>
      {batch.status === "review" && !complete && <span>Choose Yes or No for all five songs before processing.</span>}
    </div>}
    {batch?.editorial && <details open={batch.status === "processed"}><summary>What your feedback taught the station</summary><ul>
      {batch.editorial.preference_updates.map((update, index) => <li key={index}>{update.text} <small>({update.scope})</small></li>)}
    </ul></details>}
    {job?.status === "failed" && job.log_tail && <details><summary>Job details</summary><pre className={styles.logs}>{job.log_tail}</pre></details>}
  </section>;
}
