"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AdminEpisodes.module.css";

export type EpisodeJob = {
  job_id: string;
  status: string;
  accepted_at?: string;
  started_at?: string | null;
  finished_at?: string | null;
  log_tail?: string;
  local?: boolean;
  episode_options?: { request_id: string };
  result?: { episode_id?: string };
  progress?: {
    action: string;
    episode_id?: string | null;
    current: string;
    error?: string | null;
    steps: { id: string; label: string; status: string }[];
  };
};

const operations: Record<string, [string, string, string?]> = {
  ideas: ["Suggesting topics", "Topic suggestions ready", "View suggestions"],
  develop: ["Developing your idea", "Brief ready for review", "Review brief"],
  refine_brief: ["Revising the brief", "Revised brief ready for review", "Review brief"],
  queue: ["Queueing the brief", "Brief approved and queued", "View brief"],
  write: ["Generating manuscript", "Manuscript ready for review", "Read manuscript"],
  revise: ["Applying manuscript feedback", "Manuscript revised", "Read manuscript"],
  render: ["Rendering audio", "Recording ready for review", "Listen to recording"],
  publish: ["Publishing episode", "Episode published", "View published episode"],
  weekly: ["Preparing the weekly workspace", "Weekly preparation finished", "View workspace"],
  save_feedback: ["Saving feedback", "Feedback saved."],
  schedule: ["Saving weekly settings", "Weekly settings saved"],
};

export function operationText(action: string, complete = false) {
  return operations[action]?.[complete ? 1 : 0] ?? "Episode operation";
}
export const jobActive = (job: EpisodeJob | null | undefined) => ["submitting", "running", "accepted"].includes(job?.status ?? "");
export function pendingJob(action: string, episodeId?: string | null): EpisodeJob {
  return { job_id: "submitting", local: true, status: "submitting", accepted_at: new Date().toISOString(), progress: { action, episode_id: episodeId, steps: [], current: "Submitting request…" } };
}

export function EpisodeActivity({ job, compact = false, disabled, onShow, onResult, onRetry }: {
  job: EpisodeJob;
  compact?: boolean;
  disabled: boolean;
  onShow: () => void;
  onResult: () => void;
  onRetry: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const strip = useRef<HTMLDivElement>(null);
  const active = jobActive(job), failed = job.status === "failed";
  const action = job.progress?.action ?? "";
  const title = failed ? `${operationText(action)} failed` : operationText(action, !active);
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [active, job.job_id]);
  useEffect(() => {
    if (!compact) return;
    const header = document.querySelector(".appHeader");
    if (!header) return;
    const update = () => strip.current?.style.setProperty("--episode-header-offset", `${header.getBoundingClientRect().height + 8}px`);
    const observer = new ResizeObserver(update); observer.observe(header); update();
    return () => observer.disconnect();
  }, [compact]);
  const start = Date.parse(job.started_at || job.accepted_at || "");
  const end = job.finished_at ? Date.parse(job.finished_at) : now;
  const seconds = Number.isFinite(start) ? Math.max(0, Math.floor((end - start) / 1000)) : null;
  const elapsed = seconds === null ? "" : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  const resultLabel = operations[action]?.[2];
  return <div ref={strip} tabIndex={compact ? undefined : -1} id={compact ? undefined : "episode-operation"} data-action={action}
    className={`${compact ? styles.activityStrip : styles.activityCard} ${failed ? styles.activityFailed : ""}`}
    aria-label={compact ? "Current operation" : "Operation progress"}>
    <div className={styles.activityHeading}>
      <div role="status" aria-live="polite"><strong><span className={`${styles.activityDot} ${active ? styles.activityActive : ""}`} aria-hidden="true"/>{title}{active ? "…" : ""}</strong>
        {(active || failed) && <p>{job.progress?.current || "Preparing the operation"}</p>}</div>
      {elapsed && <span className={styles.elapsed}>{active ? "Elapsed" : "Duration"} {elapsed}</span>}
    </div>
    {compact ? <button disabled={disabled} onClick={active || failed ? onShow : onResult}>{active || failed || !resultLabel ? "View progress" : resultLabel}</button> : <>
      {active && <p className={styles.muted}>Work continues in the background. You can leave and return to this page.</p>}
      {!!job.progress?.steps.length && <ol className={styles.activitySteps} aria-label="Operation stages">{job.progress.steps.map(step => <li key={step.id} data-state={step.status} aria-label={`${step.label}: ${step.status}`}>
        <span aria-hidden="true">{step.status === "succeeded" ? "✓" : step.status === "failed" ? "!" : step.status === "running" ? "●" : "○"}</span>{step.label}
      </li>)}</ol>}
      {action === "write" && active && <p className={styles.muted}>Fact, story and voice reviews run in parallel after the draft.</p>}
      {failed && <p className={styles.activityError}>{job.progress?.error || "This operation did not finish. Completed work is retained."}</p>}
      <div className={styles.actions}>
        {failed && job.episode_options?.request_id && <button disabled={disabled} onClick={onRetry}>Retry saved operation</button>}
        {!active && !failed && resultLabel && <button disabled={disabled} onClick={onResult}>{resultLabel}</button>}
      </div>
      {job.log_tail && <details><summary>Show details</summary><pre className={styles.log}>{job.log_tail}</pre></details>}
    </>}
  </div>;
}
