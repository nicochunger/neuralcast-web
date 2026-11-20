"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AdminEpisodes.module.css";

type Source = { url: string; claim: string };
type Segment = {
  id: string;
  kind: string;
  artist?: string;
  title?: string;
  script?: string;
  companion?: { title: string };
  sources?: Source[];
};

type Version = {
  id: string;
  label: string;
  status: string;
  failure?: string;
  manuscript_hash: string | null;
  segments: Segment[];
  draft_segments: Segment[];
  research_notes: string;
  blockers: string[];
  findings: { id?: string; problem?: string; correction?: string; severity?: string }[];
  changes: { segment_id: string; explanation: string }[];
  production_notes: string[];
  listening_notes: { note: string }[];
  timing?: { spoken_words: number; estimated_total_seconds: number };
  metrics: Record<string, { provider: string; model: string; elapsed_seconds: number; usage: unknown }>;
  elapsed_seconds: number;
  attempts: number;
  audio: null | { revision: string; duration: number; chapters: { id: string; title: string; start: number }[] };
};

type Comparison = {
  id: string;
  current_concept: boolean;
  versions: Version[];
  pipelines: Record<string, string>;
};

const time = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function VersionReview({
  version: v,
  base,
  episodeId,
  comparisonId,
  disabled,
  revealed,
  onRender,
  onResolve,
}: {
  version: Version;
  base: string;
  episodeId: string;
  comparisonId: string;
  disabled: boolean;
  revealed: boolean;
  onRender: () => void;
  onResolve: () => void;
}) {
  const [draft, setDraft] = useState(false);
  const player = useRef<HTMLAudioElement>(null);
  const showDraft = draft || !v.segments.length;
  const segments = showDraft ? v.draft_segments : v.segments;

  useEffect(() => {
    const audio = player.current;
    return () => {
      audio?.pause();
    };
  }, [comparisonId, v.audio?.revision]);

  return (
    <article className={styles.comparisonVersion} aria-label={v.label}>
      <div className={styles.row}>
        <h5>{v.label}</h5>
        <span className={styles.rolePill}>{v.status.replaceAll("_", " ")}</span>
      </div>

      {v.failure && (
        <p className={`${styles.status} ${styles.error}`} role="alert">
          {v.failure}
        </p>
      )}

      <div className={styles.comparisonMeta}>
        {v.timing && (
          <p className={styles.metaLine}>
            {v.timing.spoken_words} words · estimated {time(v.timing.estimated_total_seconds)}
          </p>
        )}
        <p className={styles.muted}>
          {v.attempts} attempts · {time(v.elapsed_seconds)} total model time (parallel stages overlap)
        </p>
      </div>

      {!!v.blockers.length && (
        <div className={`${styles.status} ${styles.error}`} role="alert">
          <strong>The agent needs to resolve these questions</strong>
          <p>
            It can qualify conflicting accounts or remove unsupported claims. You do not need to
            research them yourself.
          </p>
          <div className={styles.actions}>
            <button type="button" disabled={disabled || !v.manuscript_hash} onClick={onResolve}>
              Resolve research questions
            </button>
          </div>
          <ul>
            {v.blockers.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ul>
        </div>
      )}

      {v.audio ? (
        <div className={styles.comparisonAudio}>
          <audio
            ref={player}
            controls
            preload="none"
            src={`${base}/${episodeId}/comparisons/${comparisonId}/${v.id}/audio/${v.audio.revision}`}
            aria-label={`${v.label} comparison audio`}
          />
          <p className={styles.metaLine}>Local listening copy · {time(v.audio.duration)}</p>
          <div className={styles.chapters}>
            {v.audio.chapters.map((chapter) => (
              <button
                type="button"
                key={chapter.id}
                onClick={() => {
                  if (player.current) {
                    player.current.currentTime = chapter.start;
                    void player.current.play();
                  }
                }}
              >
                {time(chapter.start)} · {chapter.title}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={styles.primary}
          disabled={disabled || !v.manuscript_hash || Boolean(v.blockers.length)}
          onClick={onRender}
        >
          Approve {v.label.toLowerCase()} manuscript & generate audio
        </button>
      )}

      {(Boolean(v.segments.length) || Boolean(v.draft_segments.length)) && (
        <div className={styles.comparisonDetails}>
          <label className={styles.check}>
            <input
              type="checkbox"
              checked={showDraft}
              disabled={!v.segments.length}
              onChange={(e) => setDraft(e.target.checked)}
            />
            <span>Read initial draft before reviews</span>
          </label>

          <details className={styles.inlineDisclosure}>
            <summary>{showDraft ? "Initial draft" : "Final manuscript"}</summary>
            <div className={styles.disclosureBody}>
              {segments.map((s) =>
                s.kind === "music" ? (
                  <p className={styles.song} key={s.id}>
                    ♫ {s.artist} — {s.title}
                  </p>
                ) : (
                  <section key={s.id} className={styles.comparisonSegment}>
                    <h6>{s.companion?.title || s.id}</h6>
                    <p className={styles.script}>{s.script}</p>
                    {!!s.sources?.length && (
                      <details className={styles.inlineDisclosure}>
                        <summary>Evidence</summary>
                        <div className={styles.disclosureBody}>
                          <ul className={styles.sourceList}>
                            {s.sources.map((source, i) => (
                              <li key={i}>
                                <a href={source.url} target="_blank" rel="noopener noreferrer">
                                  {source.claim}
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}
                  </section>
                )
              )}
            </div>
          </details>

          <details className={styles.inlineDisclosure}>
            <summary>Research, findings and editorial changes</summary>
            <div className={styles.disclosureBody}>
              <p className={styles.script}>{v.research_notes}</p>
              {!!v.findings.length && (
                <ul>
                  {v.findings.map((f, i) => (
                    <li key={i}>
                      {f.severity}: {f.problem} {f.correction}
                    </li>
                  ))}
                </ul>
              )}
              {!!v.changes.length && (
                <ul>
                  {v.changes.map((c, i) => (
                    <li key={i}>
                      {c.segment_id}: {c.explanation}
                    </li>
                  ))}
                </ul>
              )}
              {(Boolean(v.production_notes.length) || Boolean(v.listening_notes.length)) && (
                <ul>
                  {v.production_notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                  {v.listening_notes.map((n, i) => (
                    <li key={`listen-${i}`}>{n.note}</li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </div>
      )}

      {revealed && (
        <details className={styles.inlineDisclosure}>
          <summary>Provider usage and attempt metrics</summary>
          <div className={styles.disclosureBody}>
            <p className={styles.muted}>
              Token counts are provider-specific. Monetary cost is not estimated from Codex
              subscription usage.
            </p>
            <pre className={styles.log}>{JSON.stringify(v.metrics, null, 2)}</pre>
          </div>
        </details>
      )}
    </article>
  );
}

export function EpisodeComparison({
  base,
  episode,
  disabled,
  onAction,
}: {
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
    if (latest && latest !== latestSeen.current) {
      latestSeen.current = latest;
      setSelected(latest);
      setRevealed(false);
    }
  }, [experiments]);

  useEffect(() => {
    if (!selected) return;
    let stopped = false;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`${base}/${episode.id}/comparisons/${selected}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Unable to load comparison");
        if (!stopped) {
          setResult(data);
          setError("");
        }
      } catch (e) {
        if (!stopped) setError(e instanceof Error ? e.message : "Unable to load comparison");
      }
    }
    setResult(null);
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [base, episode.id, selected]);

  return (
    <section
      id="episode-comparison"
      tabIndex={-1}
      className={styles.comparison}
      aria-label="Pipeline comparison"
    >
      <div className={styles.comparisonIntro}>
        <h4>Compare episode pipelines</h4>
        <p className={styles.muted}>
          Generate two independent episodes from this brief: the current Codex + Gemini workflow and
          a Gemini-only workflow. Both use the same frozen brief, candidate recordings, host guidance
          and voice settings. Each version needs your manuscript approval before audio generation.
        </p>
        <p className={styles.muted}>
          Results stay separate from your working episode. Audio stays private in this panel. Song
          selection follows the approved brief; fix its songs and order for a closer writing
          comparison.
        </p>
      </div>

      <div className={styles.comparisonControls}>
        {episode.status !== "published" && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setSelected("");
              setRevealed(false);
              onAction("compare");
            }}
          >
            {episode.concept_approved
              ? "Generate both comparison versions"
              : "Approve brief & generate both comparison versions"}
          </button>
        )}

        {!!experiments.length && (
          <label className={styles.compareSelect}>
            <span>Saved comparison</span>
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setRevealed(false);
              }}
            >
              {experiments.map((x, i) => (
                <option key={x.id} value={x.id}>
                  Comparison {experiments.length - i} · {x.id.slice(0, 8)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {error && (
        <p className={`${styles.status} ${styles.error}`} role="alert">
          {error}
        </p>
      )}

      {result && (
        <div className={styles.comparisonResults}>
          {!result.current_concept && (
            <p className={styles.infoBanner}>This comparison uses an earlier brief snapshot.</p>
          )}
          <p className={styles.muted}>
            Compare the drafts as well as the final edit. Review factual support, story development,
            voice, transitions and unresolved questions. One paired run is exploratory; repeat with
            other proposals before choosing a default.
          </p>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? "Hide pipeline identities" : "Reveal pipeline identities"}
            </button>
          </div>
          {revealed && (
            <p className={styles.infoBanner}>
              {result.versions
                .map(
                  (v) =>
                    `${v.label}: ${
                      result.pipelines[v.id] === "hybrid"
                        ? "Codex research/draft and facts, Gemini reviews/edit"
                        : "Gemini Neon for every editorial stage"
                    }. `
                )
                .join("")}
              Both use the same speech model.
            </p>
          )}
          <div className={styles.comparisonGrid}>
            {result.versions.map((v) => (
              <VersionReview
                key={`${result.id}:${v.id}`}
                version={v}
                base={base}
                episodeId={episode.id}
                comparisonId={result.id}
                disabled={disabled || episode.status === "published"}
                revealed={revealed}
                onResolve={() =>
                  onAction("compare_resolve", {
                    comparison_id: result.id,
                    variant: v.id,
                    comparison_manuscript_hash: v.manuscript_hash,
                  })
                }
                onRender={() =>
                  onAction("compare_render", {
                    comparison_id: result.id,
                    variant: v.id,
                    comparison_manuscript_hash: v.manuscript_hash,
                  })
                }
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
