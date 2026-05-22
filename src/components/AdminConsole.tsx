"use client";

import { useEffect, useMemo, useState } from "react";
import type { HostAdminCapabilities, HostAdminJob, HostAdminOperationCapability } from "@/types/hostAdmin";
import {
  HOST_ADMIN_OPERATION_FORCE_ARCHETYPE,
  HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR,
  HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM,
  HOST_ADMIN_SCHEDULE_SEED_MODE_FRESH
} from "@/types/hostAdmin";
import { DEFAULT_STATION_ID, STATIONS } from "@/lib/stations";

interface AdminConsoleProps {
  isHostAdminConfigured: boolean;
}

type AdminOperation = typeof HOST_ADMIN_OPERATION_FORCE_ARCHETYPE | typeof HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR;
type AdminConsoleView = "live" | "scheduler" | "jobs";

const POLL_INTERVAL_MS = 4000;

const emptyCapabilities: HostAdminCapabilities = {
  stations: [],
  archetypes: [],
  trackFocusValues: [],
  trackFocusArchetypes: [],
  operations: {}
};

export function AdminConsole({ isHostAdminConfigured }: AdminConsoleProps) {
  const [capabilities, setCapabilities] = useState<HostAdminCapabilities>(emptyCapabilities);
  const [capabilitiesStatusMessage, setCapabilitiesStatusMessage] = useState<string | null>(null);
  const [isCapabilitiesStatusError, setIsCapabilitiesStatusError] = useState(false);
  const [isLoadingCapabilities, setIsLoadingCapabilities] = useState(false);
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(null);
  const [selectedTrackFocus, setSelectedTrackFocus] = useState<string | null>(null);
  const [forceArchetypeDryRun, setForceArchetypeDryRun] = useState(false);
  const [scheduleGeneratorDryRun, setScheduleGeneratorDryRun] = useState(false);
  const [scheduleGeneratorForceApply, setScheduleGeneratorForceApply] = useState(false);
  const [selectedScheduleGeneratorSeedMode, setSelectedScheduleGeneratorSeedMode] = useState(HOST_ADMIN_SCHEDULE_SEED_MODE_FRESH);
  const [scheduleGeneratorSeedSalt, setScheduleGeneratorSeedSalt] = useState("");
  const [scheduleGeneratorWeekStartDate, setScheduleGeneratorWeekStartDate] = useState("");
  const [scheduleGeneratorOpenRatioMin, setScheduleGeneratorOpenRatioMin] = useState("");
  const [scheduleGeneratorOpenRatioMax, setScheduleGeneratorOpenRatioMax] = useState("");
  const [scheduleGeneratorMinOpenSlots, setScheduleGeneratorMinOpenSlots] = useState("");
  const [scheduleGeneratorMaxOpenSlots, setScheduleGeneratorMaxOpenSlots] = useState("");
  const [scheduleGeneratorMinBlockMinutes, setScheduleGeneratorMinBlockMinutes] = useState("");
  const [scheduleGeneratorMaxBlockMinutes, setScheduleGeneratorMaxBlockMinutes] = useState("");
  const [submittingOperation, setSubmittingOperation] = useState<AdminOperation | null>(null);
  const [activeJob, setActiveJob] = useState<HostAdminJob | null>(null);
  const [isPollingJob, setIsPollingJob] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeConsoleView, setActiveConsoleView] = useState<AdminConsoleView>("live");

  const forceArchetypeCapability = capabilities.operations[HOST_ADMIN_OPERATION_FORCE_ARCHETYPE];
  const scheduleGeneratorCapability = capabilities.operations[HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR];
  const supportsTrackFocus =
    forceArchetypeCapability?.trackFocusSupported === true &&
    Boolean(selectedArchetype && capabilities.trackFocusArchetypes.includes(selectedArchetype));
  const normalizedScheduleSeedMode = useMemo(() => {
    const supportedSeedModes = scheduleGeneratorCapability?.supportedSeedModes ?? [];
    const defaultSeedMode =
      scheduleGeneratorCapability?.defaultSeedMode && supportedSeedModes.includes(scheduleGeneratorCapability.defaultSeedMode)
        ? scheduleGeneratorCapability.defaultSeedMode
        : supportedSeedModes[0] ?? HOST_ADMIN_SCHEDULE_SEED_MODE_FRESH;

    return supportedSeedModes.includes(selectedScheduleGeneratorSeedMode)
      ? selectedScheduleGeneratorSeedMode
      : defaultSeedMode;
  }, [scheduleGeneratorCapability, selectedScheduleGeneratorSeedMode]);

  useEffect(() => {
    if (!isHostAdminConfigured) {
      return;
    }

    void loadCapabilities();
  }, [isHostAdminConfigured]);

  useEffect(() => {
    if (!isPollingJob || !activeJob?.jobId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void refreshJob(activeJob.jobId);
    }, POLL_INTERVAL_MS);

    return () => window.clearTimeout(timeout);
  }, [activeJob?.jobId, isPollingJob]);

  async function loadCapabilities() {
    if (!isHostAdminConfigured || isLoadingCapabilities) {
      return;
    }

    setIsLoadingCapabilities(true);
    setCapabilitiesStatusMessage("Loading admin capabilities...");
    setIsCapabilitiesStatusError(false);

    try {
      const response = await fetch("/api/admin/host/capabilities", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to load host admin capabilities.");
      }

      const loaded = payload as HostAdminCapabilities;
      setCapabilities(loaded);
      setSelectedStationId((current) => resolveSelectedStation(loaded.stations, current));
      setSelectedArchetype((current) => resolveSelectedArchetype(loaded.archetypes, current));
      setSelectedTrackFocus((current) => (current && loaded.trackFocusValues.includes(current) ? current : null));
      setSelectedScheduleGeneratorSeedMode((current) => {
        const supportedSeedModes = loaded.operations[HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR]?.supportedSeedModes ?? [];
        const defaultSeedMode =
          loaded.operations[HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR]?.defaultSeedMode &&
          supportedSeedModes.includes(loaded.operations[HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR].defaultSeedMode ?? "")
            ? loaded.operations[HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR].defaultSeedMode ?? HOST_ADMIN_SCHEDULE_SEED_MODE_FRESH
            : supportedSeedModes[0] ?? HOST_ADMIN_SCHEDULE_SEED_MODE_FRESH;

        return supportedSeedModes.includes(current) ? current : defaultSeedMode;
      });
      setCapabilitiesStatusMessage(
        `Loaded ${loaded.stations.length} stations, ${loaded.archetypes.length} archetypes, and ${Object.keys(loaded.operations).length} operations.`
      );
      setIsCapabilitiesStatusError(false);
      setMessage(null);
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : "Unable to load host admin capabilities.";
      setCapabilitiesStatusMessage(nextMessage);
      setIsCapabilitiesStatusError(true);
      setMessage(nextMessage);
    } finally {
      setIsLoadingCapabilities(false);
    }
  }

  async function runForceArchetype() {
    if (!selectedStationId || !selectedArchetype || submittingOperation || isPollingJob) {
      return;
    }

    setSubmittingOperation(HOST_ADMIN_OPERATION_FORCE_ARCHETYPE);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/host/force-archetype", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          station: selectedStationId,
          archetype: selectedArchetype,
          trackFocus: supportsTrackFocus ? selectedTrackFocus : undefined,
          dryRun: forceArchetypeCapability?.dryRunSupported ? forceArchetypeDryRun : false
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to start a forced host run.");
      }

      const nextJob: HostAdminJob = {
        jobId: payload.jobId,
        operation: HOST_ADMIN_OPERATION_FORCE_ARCHETYPE,
        station: selectedStationId,
        archetype: selectedArchetype,
        trackFocus: supportsTrackFocus ? selectedTrackFocus ?? undefined : undefined,
        dryRun: forceArchetypeCapability?.dryRunSupported ? forceArchetypeDryRun : false,
        status: "accepted"
      };

      setActiveJob(nextJob);
      setIsPollingJob(true);
      setActiveConsoleView("jobs");
      setMessage("Force archetype request accepted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start a forced host run.");
    } finally {
      setSubmittingOperation(null);
    }
  }

  async function runScheduleGenerator() {
    if (!selectedStationId || submittingOperation || isPollingJob) {
      return;
    }

    const seedMode = normalizedScheduleSeedMode;
    const seedSalt = seedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM ? scheduleGeneratorSeedSalt.trim() : "";

    if (seedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM && !seedSalt) {
      setMessage("Enter a custom seed key first.");
      return;
    }

    const openRatioMin = parseOptionalNumber("Open ratio min", scheduleGeneratorOpenRatioMin, true);
    const openRatioMax = parseOptionalNumber("Open ratio max", scheduleGeneratorOpenRatioMax, true);
    const minOpenSlots = parseOptionalInteger("Min open slots", scheduleGeneratorMinOpenSlots, true);
    const maxOpenSlots = parseOptionalInteger("Max open slots", scheduleGeneratorMaxOpenSlots, true);
    const minBlockMinutes = parseOptionalInteger("Min block minutes", scheduleGeneratorMinBlockMinutes, true);
    const maxBlockMinutes = parseOptionalInteger("Max block minutes", scheduleGeneratorMaxBlockMinutes, true);

    if ([openRatioMin, openRatioMax, minOpenSlots, maxOpenSlots, minBlockMinutes, maxBlockMinutes].includes(null)) {
      return;
    }

    setSubmittingOperation(HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/host/schedule-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          station: selectedStationId,
          dryRun: scheduleGeneratorCapability?.dryRunSupported ? scheduleGeneratorDryRun : false,
          forceApply:
            scheduleGeneratorCapability?.forceApplySupported && !scheduleGeneratorDryRun
              ? scheduleGeneratorForceApply
              : false,
          seedMode: scheduleGeneratorCapability?.supportedSeedModes?.length ? seedMode : undefined,
          seedSalt: seedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM ? seedSalt : undefined,
          weekStartDate:
            scheduleGeneratorCapability?.weekStartDateSupported && scheduleGeneratorWeekStartDate.trim()
              ? scheduleGeneratorWeekStartDate.trim()
              : undefined,
          openRatioMin: supportsTuningField("open_ratio_min") ? openRatioMin ?? undefined : undefined,
          openRatioMax: supportsTuningField("open_ratio_max") ? openRatioMax ?? undefined : undefined,
          minOpenSlots: supportsTuningField("min_open_slots") ? minOpenSlots ?? undefined : undefined,
          maxOpenSlots: supportsTuningField("max_open_slots") ? maxOpenSlots ?? undefined : undefined,
          minBlockMinutes: supportsTuningField("min_block_minutes") ? minBlockMinutes ?? undefined : undefined,
          maxBlockMinutes: supportsTuningField("max_block_minutes") ? maxBlockMinutes ?? undefined : undefined
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to start the schedule generator.");
      }

      const nextJob: HostAdminJob = {
        jobId: payload.jobId,
        operation: HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR,
        station: selectedStationId,
        dryRun: scheduleGeneratorCapability?.dryRunSupported ? scheduleGeneratorDryRun : false,
        status: "accepted",
        scheduleOptions: {
          forceApply:
            scheduleGeneratorCapability?.forceApplySupported && !scheduleGeneratorDryRun
              ? scheduleGeneratorForceApply
              : false,
          seedMode: scheduleGeneratorCapability?.supportedSeedModes?.length ? seedMode : undefined,
          seedSalt: seedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM ? seedSalt : undefined,
          weekStartDate:
            scheduleGeneratorCapability?.weekStartDateSupported && scheduleGeneratorWeekStartDate.trim()
              ? scheduleGeneratorWeekStartDate.trim()
              : undefined,
          openRatioMin: supportsTuningField("open_ratio_min") ? openRatioMin ?? undefined : undefined,
          openRatioMax: supportsTuningField("open_ratio_max") ? openRatioMax ?? undefined : undefined,
          minOpenSlots: supportsTuningField("min_open_slots") ? minOpenSlots ?? undefined : undefined,
          maxOpenSlots: supportsTuningField("max_open_slots") ? maxOpenSlots ?? undefined : undefined,
          minBlockMinutes: supportsTuningField("min_block_minutes") ? minBlockMinutes ?? undefined : undefined,
          maxBlockMinutes: supportsTuningField("max_block_minutes") ? maxBlockMinutes ?? undefined : undefined
        }
      };

      setActiveJob(nextJob);
      setIsPollingJob(true);
      setActiveConsoleView("jobs");
      setMessage("Schedule generator request accepted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start the schedule generator.");
    } finally {
      setSubmittingOperation(null);
    }
  }

  async function refreshJob(jobId: string) {
    try {
      const response = await fetch(`/api/admin/host/jobs/${jobId}`, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Unable to refresh host job status.");
      }

      const job = payload as HostAdminJob;
      const terminal = isTerminalJobStatus(job.status);

      setActiveJob(job);
      setIsPollingJob(!terminal);

      if (terminal) {
        setMessage(buildJobStatusMessage(job));
      }
    } catch (error) {
      setIsPollingJob(false);
      setMessage(error instanceof Error ? error.message : "Unable to refresh host job status.");
    }
  }

  function supportsOperation(operation: string) {
    return Boolean(capabilities.operations[operation]);
  }

  function supportsTuningField(field: string) {
    return scheduleGeneratorCapability?.supportedTuningFields.includes(field) === true;
  }

  function parseOptionalNumber(label: string, rawValue: string, enabled: boolean) {
    if (!enabled) {
      return undefined;
    }

    const trimmed = rawValue.trim();

    if (!trimmed) {
      return undefined;
    }

    const value = Number(trimmed);

    if (!Number.isFinite(value)) {
      setMessage(`${label} must be a valid number.`);
      return null;
    }

    return value;
  }

  function parseOptionalInteger(label: string, rawValue: string, enabled: boolean) {
    if (!enabled) {
      return undefined;
    }

    const trimmed = rawValue.trim();

    if (!trimmed) {
      return undefined;
    }

    if (!/^-?\d+$/.test(trimmed)) {
      setMessage(`${label} must be a whole number.`);
      return null;
    }

    return Number.parseInt(trimmed, 10);
  }

  const messageIsError =
    message !== null &&
    ["failed", "unable", "invalid", "unauthorized", "error"].some((fragment) => message.toLowerCase().includes(fragment));
  const operationsCount = Object.keys(capabilities.operations).length;

  return (
    <>
      <section className="adminHero">
        <div>
          <p className="sectionEyebrow">Control room</p>
          <h2>Admin dashboard</h2>
          <p className="adminLead">
            Skip-track controls stay on the main radio page. The full host console lives here and mirrors the Android app’s orchestration tools.
          </p>
        </div>
      </section>

      {!isHostAdminConfigured ? (
        <section className="adminPanel adminConsoleStack">
          <h3>Host orchestrator</h3>
          <p>Add `HOST_ADMIN_BASE_URL` and `HOST_ADMIN_TOKEN` in your env vars to unlock the full AI host console.</p>
        </section>
      ) : (
        <div className="adminConsoleStack">
          <section className="adminPanel adminOverviewPanel">
            <div className="adminPanelHeader">
              <div>
                <h3>Host orchestrator</h3>
                <p>The VPS-backed host admin API is configured server-side. Pick a station here, then move between live overrides, scheduling, and job monitoring.</p>
              </div>
              <button className="adminGhostButton" type="button" onClick={() => void loadCapabilities()} disabled={isLoadingCapabilities}>
                {isLoadingCapabilities ? "Refreshing..." : "Refresh capabilities"}
              </button>
            </div>

            {capabilitiesStatusMessage ? (
              <p className={`adminStatusNotice ${isCapabilitiesStatusError ? "adminStatusNoticeError" : "adminStatusNoticeSuccess"}`}>
                {capabilitiesStatusMessage}
              </p>
            ) : null}

            {message ? (
              <p className={`adminStatusNotice ${messageIsError ? "adminStatusNoticeError" : "adminStatusNoticeSuccess"}`}>
                {message}
              </p>
            ) : null}

            <div className="adminOverviewStats">
              <div className="adminOverviewStat">
                <span>Stations</span>
                <strong>{capabilities.stations.length}</strong>
              </div>
              <div className="adminOverviewStat">
                <span>Archetypes</span>
                <strong>{capabilities.archetypes.length}</strong>
              </div>
              <div className="adminOverviewStat">
                <span>Operations</span>
                <strong>{operationsCount}</strong>
              </div>
              <div className="adminOverviewStat">
                <span>Jobs</span>
                <strong>{isPollingJob ? "Running" : activeJob ? toStatusLabel(activeJob.status) : "Idle"}</strong>
              </div>
            </div>

            {capabilities.stations.length ? (
              <div className="adminSection">
                <div className="adminSectionHeading">
                  <h4>Target station</h4>
                  <p>Select the station that the control room should target.</p>
                </div>
                <div className="adminChipRow">
                  {capabilities.stations.map((stationId) => (
                    <button
                      key={stationId}
                      className={`adminChip ${selectedStationId === stationId ? "adminChipActive" : ""}`}
                      type="button"
                      onClick={() => setSelectedStationId(stationId)}
                    >
                      {stationLabel(stationId)}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <div className="adminConsoleTabs" role="tablist" aria-label="Admin console sections">
            <button
              className={`adminConsoleTab ${activeConsoleView === "live" ? "adminConsoleTabActive" : ""}`}
              type="button"
              onClick={() => setActiveConsoleView("live")}
            >
              Live Overrides
            </button>
            <button
              className={`adminConsoleTab ${activeConsoleView === "scheduler" ? "adminConsoleTabActive" : ""}`}
              type="button"
              onClick={() => setActiveConsoleView("scheduler")}
            >
              Scheduler
            </button>
            <button
              className={`adminConsoleTab ${activeConsoleView === "jobs" ? "adminConsoleTabActive" : ""}`}
              type="button"
              onClick={() => setActiveConsoleView("jobs")}
            >
              Jobs & Logs
            </button>
          </div>

          <div className="adminWorkspace">
            <div className="adminWorkspacePrimary">
              <section
                className={`adminPanel adminWorkspaceSection ${activeConsoleView === "live" ? "adminWorkspaceSectionActive" : ""}`}
              >
                <div className="adminSectionHeading">
                  <h3>Live Overrides</h3>
                  <p>Use these controls for immediate host intervention on the selected station.</p>
                </div>

                {supportsOperation(HOST_ADMIN_OPERATION_FORCE_ARCHETYPE) ? (
                  <>
                    {capabilities.archetypes.length === 0 && !isLoadingCapabilities ? (
                      <p>No archetypes are loaded yet. Refresh capabilities to fetch them from the server.</p>
                    ) : null}

                    <label className="adminField">
                      <span>Archetype</span>
                      <select
                        value={selectedArchetype ?? ""}
                        onChange={(event) => {
                          const archetype = event.target.value || null;
                          setSelectedArchetype(archetype);
                          setSelectedTrackFocus((current) =>
                            archetype && capabilities.trackFocusArchetypes.includes(archetype) ? current : null
                          );
                        }}
                        disabled={capabilities.archetypes.length === 0}
                      >
                        <option value="">Select archetype</option>
                        {capabilities.archetypes.map((archetype) => (
                          <option key={archetype} value={archetype}>
                            {toArchetypeLabel(archetype)}
                          </option>
                        ))}
                      </select>
                    </label>

                    {forceArchetypeCapability?.dryRunSupported ? (
                      <div className="adminChipRow">
                        <button
                          className={`adminChip ${forceArchetypeDryRun ? "adminChipActive" : ""}`}
                          type="button"
                          onClick={() => setForceArchetypeDryRun((value) => !value)}
                        >
                          Dry run
                        </button>
                      </div>
                    ) : null}

                    {supportsTrackFocus ? (
                      <div className="adminSubsection">
                        <div className="adminSectionHeading">
                          <h5>Track focus</h5>
                          <p>Optional. Leave it unset to let the server pick the focus automatically.</p>
                        </div>
                        <div className="adminChipRow">
                          {capabilities.trackFocusValues.map((trackFocus) => (
                            <button
                              key={trackFocus}
                              className={`adminChip ${selectedTrackFocus === trackFocus ? "adminChipActive" : ""}`}
                              type="button"
                              onClick={() => setSelectedTrackFocus(trackFocus)}
                            >
                              {toTrackFocusLabel(trackFocus)}
                            </button>
                          ))}
                        </div>
                        <button className="adminTextButton" type="button" onClick={() => setSelectedTrackFocus(null)} disabled={!selectedTrackFocus}>
                          Use server default
                        </button>
                      </div>
                    ) : null}

                    <button
                      className="authSubmitButton adminPrimaryButton"
                      type="button"
                      onClick={() => void runForceArchetype()}
                      disabled={!selectedStationId || !selectedArchetype || isLoadingCapabilities || Boolean(submittingOperation) || isPollingJob}
                    >
                      {submittingOperation === HOST_ADMIN_OPERATION_FORCE_ARCHETYPE
                        ? "Submitting..."
                        : isPollingJob && activeJob?.operation === HOST_ADMIN_OPERATION_FORCE_ARCHETYPE
                          ? "Job Running..."
                          : "Run Force Archetype"}
                    </button>
                  </>
                ) : (
                  <div className="adminEmptyState">
                    <strong>Live overrides unavailable</strong>
                    <p>The host does not currently expose the force-archetype operation.</p>
                  </div>
                )}
              </section>

              <section
                className={`adminPanel adminWorkspaceSection ${activeConsoleView === "scheduler" ? "adminWorkspaceSectionActive" : ""}`}
              >
                <div className="adminSectionHeading">
                  <h3>Scheduler Generator</h3>
                  <p>Configure generation strategy, timing, and tuning for the selected station.</p>
                </div>

                {supportsOperation(HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR) ? (
                  <>
                    {(scheduleGeneratorCapability?.dryRunSupported || scheduleGeneratorCapability?.forceApplySupported) ? (
                      <div className="adminChipRow">
                        {scheduleGeneratorCapability?.dryRunSupported ? (
                          <button
                            className={`adminChip ${scheduleGeneratorDryRun ? "adminChipActive" : ""}`}
                            type="button"
                            onClick={() => {
                              setScheduleGeneratorDryRun((value) => {
                                const next = !value;

                                if (next) {
                                  setScheduleGeneratorForceApply(false);
                                }

                                return next;
                              });
                            }}
                          >
                            Dry run
                          </button>
                        ) : null}
                        {scheduleGeneratorCapability?.forceApplySupported ? (
                          <button
                            className={`adminChip ${scheduleGeneratorForceApply ? "adminChipActive" : ""}`}
                            type="button"
                            onClick={() => setScheduleGeneratorForceApply((value) => !value)}
                            disabled={scheduleGeneratorDryRun}
                          >
                            Force apply
                          </button>
                        ) : null}
                      </div>
                    ) : null}

                    {scheduleGeneratorCapability?.supportedSeedModes.length ? (
                      <div className="adminSubsection">
                        <div className="adminSectionHeading">
                          <h5>Seed mode</h5>
                          <p>Use stable mode for deterministic weekly plans, fresh for a reroll, or custom to reproduce a manual variation.</p>
                        </div>
                        <div className="adminChipRow">
                          {scheduleGeneratorCapability.supportedSeedModes.map((seedMode) => (
                            <button
                              key={seedMode}
                              className={`adminChip ${normalizedScheduleSeedMode === seedMode ? "adminChipActive" : ""}`}
                              type="button"
                              onClick={() => {
                                setSelectedScheduleGeneratorSeedMode(seedMode);
                                if (seedMode !== HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM) {
                                  setScheduleGeneratorSeedSalt("");
                                }
                              }}
                            >
                              {toSeedModeLabel(seedMode)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {normalizedScheduleSeedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM ? (
                      <label className="adminField">
                        <span>Custom seed key</span>
                        <input value={scheduleGeneratorSeedSalt} onChange={(event) => setScheduleGeneratorSeedSalt(event.target.value)} />
                      </label>
                    ) : null}

                    {scheduleGeneratorCapability?.weekStartDateSupported ? (
                      <label className="adminField">
                        <span>Week start date (YYYY-MM-DD)</span>
                        <input value={scheduleGeneratorWeekStartDate} onChange={(event) => setScheduleGeneratorWeekStartDate(event.target.value)} />
                      </label>
                    ) : null}

                    {(supportsTuningField("open_ratio_min") ||
                      supportsTuningField("open_ratio_max") ||
                      supportsTuningField("min_open_slots") ||
                      supportsTuningField("max_open_slots") ||
                      supportsTuningField("min_block_minutes") ||
                      supportsTuningField("max_block_minutes")) ? (
                      <div className="adminSubsection">
                        <div className="adminSectionHeading">
                          <h5>Tuning</h5>
                          <p>Leave fields blank to use the server defaults.</p>
                        </div>
                        <div className="adminFieldGrid">
                          {supportsTuningField("open_ratio_min") ? (
                            <label className="adminField">
                              <span>Open ratio min</span>
                              <input value={scheduleGeneratorOpenRatioMin} onChange={(event) => setScheduleGeneratorOpenRatioMin(event.target.value)} inputMode="decimal" />
                            </label>
                          ) : null}
                          {supportsTuningField("open_ratio_max") ? (
                            <label className="adminField">
                              <span>Open ratio max</span>
                              <input value={scheduleGeneratorOpenRatioMax} onChange={(event) => setScheduleGeneratorOpenRatioMax(event.target.value)} inputMode="decimal" />
                            </label>
                          ) : null}
                          {supportsTuningField("min_open_slots") ? (
                            <label className="adminField">
                              <span>Min open slots</span>
                              <input value={scheduleGeneratorMinOpenSlots} onChange={(event) => setScheduleGeneratorMinOpenSlots(event.target.value)} inputMode="numeric" />
                            </label>
                          ) : null}
                          {supportsTuningField("max_open_slots") ? (
                            <label className="adminField">
                              <span>Max open slots</span>
                              <input value={scheduleGeneratorMaxOpenSlots} onChange={(event) => setScheduleGeneratorMaxOpenSlots(event.target.value)} inputMode="numeric" />
                            </label>
                          ) : null}
                          {supportsTuningField("min_block_minutes") ? (
                            <label className="adminField">
                              <span>Min block minutes</span>
                              <input value={scheduleGeneratorMinBlockMinutes} onChange={(event) => setScheduleGeneratorMinBlockMinutes(event.target.value)} inputMode="numeric" />
                            </label>
                          ) : null}
                          {supportsTuningField("max_block_minutes") ? (
                            <label className="adminField">
                              <span>Max block minutes</span>
                              <input value={scheduleGeneratorMaxBlockMinutes} onChange={(event) => setScheduleGeneratorMaxBlockMinutes(event.target.value)} inputMode="numeric" />
                            </label>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <button
                      className="authSubmitButton adminPrimaryButton"
                      type="button"
                      onClick={() => void runScheduleGenerator()}
                      disabled={!selectedStationId || isLoadingCapabilities || Boolean(submittingOperation) || isPollingJob}
                    >
                      {submittingOperation === HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR
                        ? "Submitting..."
                        : isPollingJob && activeJob?.operation === HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR
                          ? "Job Running..."
                          : "Run Schedule Generator"}
                    </button>
                  </>
                ) : (
                  <div className="adminEmptyState">
                    <strong>Scheduler unavailable</strong>
                    <p>The host does not currently expose the schedule generator operation.</p>
                  </div>
                )}
              </section>
            </div>

            <div className="adminWorkspaceSecondary">
              {activeJob ? (
                <HostAdminJobPanel
                  job={activeJob}
                  isPolling={isPollingJob}
                  className={activeConsoleView === "jobs" ? "adminWorkspaceSectionActive" : ""}
                />
              ) : (
                <section
                  className={`adminPanel adminWorkspaceSection ${activeConsoleView === "jobs" ? "adminWorkspaceSectionActive" : ""}`}
                >
                  <div className="adminSectionHeading">
                    <h3>Jobs & Logs</h3>
                    <p>Monitor the latest host run and inspect the tail output from the orchestrator.</p>
                  </div>
                  <div className="adminEmptyState">
                    <strong>No jobs yet</strong>
                    <p>Run a live override or schedule generation task to populate this panel.</p>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function HostAdminJobPanel({ job, isPolling, className = "" }: { job: HostAdminJob; isPolling: boolean; className?: string }) {
  const statusLabel = toStatusLabel(job.status);
  const scheduleLines = job.scheduleOptions
    ? [
        job.scheduleOptions.forceApply ? "Force apply enabled" : null,
        job.scheduleOptions.seedMode ? `Seed mode: ${toSeedModeLabel(job.scheduleOptions.seedMode)}` : null,
        job.scheduleOptions.seedSalt
          ? `${job.scheduleOptions.seedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM ? "Custom seed" : "Seed salt"}: ${job.scheduleOptions.seedSalt}`
          : null,
        job.scheduleOptions.weekStartDate ? `Week start: ${job.scheduleOptions.weekStartDate}` : null,
        job.scheduleOptions.openRatioMin !== undefined ? `Open ratio min: ${job.scheduleOptions.openRatioMin}` : null,
        job.scheduleOptions.openRatioMax !== undefined ? `Open ratio max: ${job.scheduleOptions.openRatioMax}` : null,
        job.scheduleOptions.minOpenSlots !== undefined ? `Min open slots: ${job.scheduleOptions.minOpenSlots}` : null,
        job.scheduleOptions.maxOpenSlots !== undefined ? `Max open slots: ${job.scheduleOptions.maxOpenSlots}` : null,
        job.scheduleOptions.minBlockMinutes !== undefined ? `Min block minutes: ${job.scheduleOptions.minBlockMinutes}` : null,
        job.scheduleOptions.maxBlockMinutes !== undefined ? `Max block minutes: ${job.scheduleOptions.maxBlockMinutes}` : null
      ].filter(Boolean)
    : [];

  return (
    <section className={`adminPanel adminConsoleStack adminWorkspaceSection ${className}`.trim()}>
      <div className="adminPanelHeader">
        <div>
          <h3>Jobs & Logs</h3>
          <p>{stationLabel(job.station)} · {toOperationLabel(job.operation)}</p>
        </div>
        <span className={`adminJobBadge adminJobBadge${toStatusClassName(job.status)}`}>
          {isPolling && !isTerminalJobStatus(job.status) ? "Polling..." : statusLabel}
        </span>
      </div>

      {job.archetype ? <p>Archetype: {toArchetypeLabel(job.archetype)}</p> : null}
      {job.trackFocus ? <p>Focus: {toTrackFocusLabel(job.trackFocus)}</p> : null}
      {job.dryRun ? <p>Mode: Dry run</p> : null}
      {scheduleLines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {job.exitCode !== undefined ? <p>Exit code: {job.exitCode}</p> : null}
      {job.acceptedAt ? <p>Accepted: {job.acceptedAt}</p> : null}
      {job.startedAt ? <p>Started: {job.startedAt}</p> : null}
      {job.finishedAt ? <p>Finished: {job.finishedAt}</p> : null}
      {job.logTail ? <pre className="adminLogTail">{job.logTail.trim()}</pre> : null}
    </section>
  );
}

function resolveSelectedStation(availableStations: string[], currentSelection: string | null) {
  if (currentSelection && availableStations.includes(currentSelection)) {
    return currentSelection;
  }

  return availableStations.includes(DEFAULT_STATION_ID) ? DEFAULT_STATION_ID : (availableStations[0] ?? null);
}

function resolveSelectedArchetype(availableArchetypes: string[], currentSelection: string | null) {
  if (currentSelection && availableArchetypes.includes(currentSelection)) {
    return currentSelection;
  }

  return availableArchetypes[0] ?? null;
}

function isTerminalJobStatus(status: string) {
  return status.toLowerCase() === "succeeded" || status.toLowerCase() === "failed";
}

function buildJobStatusMessage(job: HostAdminJob) {
  const operationLabel = job.operation === HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR ? "Schedule generator" : "Force archetype";

  if (job.status.toLowerCase() === "succeeded") {
    return `${operationLabel} completed for ${job.station}.`;
  }

  return `${operationLabel} failed for ${job.station}${job.exitCode !== undefined ? ` (exit code ${job.exitCode})` : ""}.`;
}

function stationLabel(stationId: string) {
  return STATIONS.find((station) => station.id === stationId)?.name ?? humanize(stationId);
}

function toArchetypeLabel(value: string) {
  return humanize(value);
}

function toTrackFocusLabel(value: string) {
  if (value === "current") {
    return "Current track";
  }

  if (value === "next") {
    return "Next track";
  }

  return humanize(value);
}

function toSeedModeLabel(value: string) {
  if (value === "stable_week") {
    return "Stable week";
  }

  if (value === "fresh") {
    return "Fresh";
  }

  if (value === "custom") {
    return "Custom";
  }

  return humanize(value);
}

function toOperationLabel(value: string) {
  if (value === HOST_ADMIN_OPERATION_FORCE_ARCHETYPE) {
    return "Force Archetype";
  }

  if (value === HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR) {
    return "Schedule Generator";
  }

  return humanize(value);
}

function toStatusLabel(value: string) {
  switch (value.toLowerCase()) {
    case "accepted":
      return "Accepted";
    case "running":
      return "Running";
    case "succeeded":
      return "Succeeded";
    default:
      return "Failed";
  }
}

function toStatusClassName(value: string) {
  switch (value.toLowerCase()) {
    case "accepted":
      return "Accepted";
    case "running":
      return "Running";
    case "succeeded":
      return "Succeeded";
    default:
      return "Failed";
  }
}

function humanize(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
