"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AdminTestStreamPlayer } from "@/components/AdminTestStreamPlayer";
import { AdminListeners } from "@/components/AdminListeners";
import { useEffect, useMemo, useState } from "react";
import type { HostAdminCapabilities, HostAdminJob, HostAdminOperationCapability } from "@/types/hostAdmin";
import {
  HOST_ADMIN_OPERATION_FORCE_ARCHETYPE,
  HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR,
  HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM,
  HOST_ADMIN_SCHEDULE_SEED_MODE_FRESH
} from "@/types/hostAdmin";
import { adminText as t } from "@/lib/adminCopy";
import { DEFAULT_STATION_ID, STATIONS } from "@/lib/stations";

interface AdminConsoleProps {
  isHostAdminConfigured: boolean;
}

type AdminText = typeof t;

type AdminOperation = typeof HOST_ADMIN_OPERATION_FORCE_ARCHETYPE | typeof HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR;

const POLL_INTERVAL_MS = 4000;

const emptyCapabilities: HostAdminCapabilities = {
  stations: [],
  hostChannels: [],
  archetypes: [],
  trackFocusValues: [],
  trackFocusArchetypes: [],
  operations: {}
};

export function AdminConsole({ isHostAdminConfigured }: AdminConsoleProps) {
  const pathname = usePathname();
  const section = pathname.split("/")[2] || "host";
  const [pollError, setPollError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [pollRevision, setPollRevision] = useState(0);
  const [capabilities, setCapabilities] = useState<HostAdminCapabilities>(emptyCapabilities);
  const [capabilitiesStatusMessage, setCapabilitiesStatusMessage] = useState<string | null>(null);
  const [isCapabilitiesStatusError, setIsCapabilitiesStatusError] = useState(false);
  const [isLoadingCapabilities, setIsLoadingCapabilities] = useState(false);
  const [forceArchetypeStationId, setForceArchetypeStationId] = useState<string | null>(null);
  const [scheduleGeneratorStationId, setScheduleGeneratorStationId] = useState<string | null>(null);
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

  const forceArchetypeCapability = capabilities.operations[HOST_ADMIN_OPERATION_FORCE_ARCHETYPE];
  const scheduleGeneratorCapability = capabilities.operations[HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR];
  const forceArchetypeTargets = useMemo(
    () => capabilities.hostChannels.length ? capabilities.hostChannels : capabilities.stations,
    [capabilities.hostChannels, capabilities.stations]
  );
  const stationGroups = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; targets: { id: string; language: string }[] }>();
    for (const target of forceArchetypeTargets) {
      const station = STATIONS.find(station => station.id === target || station.hostChannels.some(channel => channel.id === target) || target.startsWith(`${station.id}-`));
      const id = station?.id ?? target;
      const channel = station?.hostChannels.find(channel => channel.id === target);
      const locale = channel?.locale ?? (station && target !== station.id ? target.slice(station.id.length + 1) : undefined);
      const language = locale ? new Intl.DisplayNames(["en"], { type: "language" }).of(locale.split("-")[0]) ?? locale : "Station default";
      if (!groups.has(id)) groups.set(id, { id, name: station?.name ?? humanize(target), targets: [] });
      groups.get(id)!.targets.push({ id: target, language });
    }
    return [...groups.values()];
  }, [forceArchetypeTargets]);
  const selectedStationGroup = stationGroups.find(group => group.targets.some(target => target.id === forceArchetypeStationId));
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
  const isCustomSeedMissing =
    normalizedScheduleSeedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM &&
    scheduleGeneratorSeedSalt.trim().length === 0;


  useEffect(() => {
    if (!isPollingJob || !activeJob?.jobId) return;
    const jobId = activeJob.jobId;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController | undefined;
    let busy = false;
    let failures = 0;
    async function poll() {
      if (stopped || busy) return;
      clearTimeout(timer);
      busy = true;
      controller = new AbortController();
      const timeout = setTimeout(() => controller?.abort(), 20000);
      let terminal = false;
      try {
        const response = await fetch(`/api/admin/host/jobs/${encodeURIComponent(jobId)}`, { cache: "no-store", signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to refresh job.");
        if (stopped) return;
        const job = payload as HostAdminJob;
        terminal = isTerminalJobStatus(job.status);
        failures = 0;
        setActiveJob(job);
        setPollError(null);
        setLastUpdated(new Date().toLocaleTimeString("en-GB"));
        if (terminal) {
          setIsPollingJob(false);
          setMessage(buildJobStatusMessage(job, t));
        }
      } catch (error) {
        if (!stopped) {
          failures++;
          setPollError(`${error instanceof Error ? error.message : "Connection interrupted"} Retrying automatically…`);
        }
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!stopped && !terminal) timer = setTimeout(poll, Math.min(POLL_INTERVAL_MS * 2 ** failures, 30000));
      }
    }
    const resume = () => { if (document.visibilityState === "visible") void poll(); };
    void poll();
    window.addEventListener("online", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller?.abort();
      window.removeEventListener("online", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [activeJob?.jobId, isPollingJob, pollRevision, t]);

  useEffect(() => {
    if (!isHostAdminConfigured) return;
    let stopped = false;
    let retry: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function loadCapabilities() {
      if (stopped) {
        return;
      }

      setIsLoadingCapabilities(true);
      setCapabilitiesStatusMessage(t("admin.loadingCapabilities"));
      setIsCapabilitiesStatusError(false);

      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      try {
        const response = await fetch("/api/admin/host/capabilities", { cache: "no-store", signal: controller.signal });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error || t("admin.loadCapabilitiesError"));
        }

        if (stopped) return;
        const loaded = payload as HostAdminCapabilities;
        const loadedForceTargets = loaded.hostChannels?.length
          ? loaded.hostChannels
          : loaded.stations;
        setCapabilities(loaded);
        setForceArchetypeStationId((current) => resolveSelectedStation(loadedForceTargets, current));
        setScheduleGeneratorStationId((current) => resolveSelectedStation(loaded.stations, current));
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
        setCapabilitiesStatusMessage(null);
        setIsCapabilitiesStatusError(false);

      } catch (error) {
        if (stopped) return;
        retry = setTimeout(() => void loadCapabilities(), 10000);
        const nextMessage = error instanceof Error ? error.message : t("admin.loadCapabilitiesError");
        setCapabilitiesStatusMessage(`${nextMessage} Retrying automatically…`);
        setIsCapabilitiesStatusError(true);

      } finally {
        clearTimeout(timeout);
        if (!stopped) setIsLoadingCapabilities(false);
      }
    }

    void loadCapabilities();
    return () => { stopped = true; clearTimeout(retry); controller?.abort(); };
  }, [isHostAdminConfigured]);

  async function runForceArchetype() {
    if (!forceArchetypeStationId || !selectedArchetype || submittingOperation || isPollingJob) {
      return;
    }

    setSubmittingOperation(HOST_ADMIN_OPERATION_FORCE_ARCHETYPE);
    setMessage(null);

    try {
      const response = await fetch("/api/admin/host/force-archetype", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          station: forceArchetypeStationId,
          archetype: selectedArchetype,
          trackFocus: supportsTrackFocus ? selectedTrackFocus : undefined,
          dryRun: forceArchetypeCapability?.dryRunSupported ? forceArchetypeDryRun : false
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || t("admin.forceArchetypeError"));
      }

      const nextJob: HostAdminJob = {
        jobId: payload.jobId,
        operation: HOST_ADMIN_OPERATION_FORCE_ARCHETYPE,
        station: forceArchetypeStationId,
        archetype: selectedArchetype,
        trackFocus: supportsTrackFocus ? selectedTrackFocus ?? undefined : undefined,
        dryRun: forceArchetypeCapability?.dryRunSupported ? forceArchetypeDryRun : false,
        status: "accepted"
      };

      setActiveJob(nextJob);
      setIsPollingJob(true);
      setMessage(t("admin.forceArchetypeAccepted"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("admin.forceArchetypeError"));
    } finally {
      setSubmittingOperation(null);
    }
  }

  async function runScheduleGenerator() {
    if (!scheduleGeneratorStationId || submittingOperation || isPollingJob) {
      return;
    }

    const seedMode = normalizedScheduleSeedMode;
    const seedSalt = seedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM ? scheduleGeneratorSeedSalt.trim() : "";

    if (seedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM && !seedSalt) {
      setMessage(t("admin.enterCustomSeed"));
      return;
    }

    const openRatioMin = parseOptionalNumber(t("admin.openRatioMin"), scheduleGeneratorOpenRatioMin, true);
    const openRatioMax = parseOptionalNumber(t("admin.openRatioMax"), scheduleGeneratorOpenRatioMax, true);
    const minOpenSlots = parseOptionalInteger(t("admin.minOpenSlots"), scheduleGeneratorMinOpenSlots, true);
    const maxOpenSlots = parseOptionalInteger(t("admin.maxOpenSlots"), scheduleGeneratorMaxOpenSlots, true);
    const minBlockMinutes = parseOptionalInteger(t("admin.minBlockMinutes"), scheduleGeneratorMinBlockMinutes, true);
    const maxBlockMinutes = parseOptionalInteger(t("admin.maxBlockMinutes"), scheduleGeneratorMaxBlockMinutes, true);

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
          station: scheduleGeneratorStationId,
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
        throw new Error(payload.error || t("admin.scheduleGeneratorError"));
      }

      const nextJob: HostAdminJob = {
        jobId: payload.jobId,
        operation: HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR,
        station: scheduleGeneratorStationId,
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
      setMessage(t("admin.scheduleGeneratorAccepted"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t("admin.scheduleGeneratorError"));
    } finally {
      setSubmittingOperation(null);
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
      setMessage(t("admin.invalidNumber", { label }));
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
      setMessage(t("admin.invalidInteger", { label }));
      return null;
    }

    return Number.parseInt(trimmed, 10);
  }

  return (
    <div className="adminWorkspace">
      <nav className="adminSidebar" aria-label="Admin navigation">
        <p className="sectionEyebrow">WORKSPACE</p>
        {[
          ["host", "/admin", "01", "AI host", "Create a radio moment"],
          ["schedule", "/admin/schedule", "02", "Scheduling", "Shape the week ahead"],
          ["listeners", "/admin/listeners", "03", "Listeners", "Know your audience"],
          ["preview", "/admin/preview", "04", "Stream preview", "Listen before going live"]
        ].map(([id, href, number, label, description]) => <Link key={id} href={href} className={`adminNavItem ${section === id ? "isActive" : ""}`} aria-current={section === id ? "page" : undefined}><span>{number}</span><div><strong>{label}</strong><small>{description}</small></div></Link>)}
        <p className="adminSidebarNote">NeuralCast / Control room</p>
      </nav>
      <div className="adminMain">
      <section className="adminHero">
        <div>
          <p className="sectionEyebrow">{t("admin.controlRoom")}</p>
          <h2>{{ host: "Make the airwaves yours.", schedule: "A rhythm for every day.", listeners: "On the other side of the stream.", preview: "Your private listening room." }[section]}</h2>
          <p className="adminLead">{{ host: "Craft an AI host segment. Follow every step as it comes to life.", schedule: "Build your station’s next chapter, one week at a time.", listeners: "Live connections and listening history, directly from AzuraCast.", preview: "Check the test stream in a dedicated preview player." }[section]}</p>
        </div>
      </section>

      {section === "listeners" ? <AdminListeners /> : section === "preview" ? <AdminTestStreamPlayer /> : !isHostAdminConfigured ? (
        <section className="adminPanel adminConsoleStack">
          <h3>{t("admin.hostOrchestrator")}</h3>
          <p>{t("admin.hostNotConfigured")}</p>
        </section>
      ) : (
        <div className="adminWorkGrid"><div className="adminConsoleStack">
          {capabilitiesStatusMessage && (isLoadingCapabilities || isCapabilitiesStatusError) ? (
            <p className={`adminStatusNotice ${isCapabilitiesStatusError ? "adminStatusNoticeError" : ""}`} role="status">
              {capabilitiesStatusMessage}
            </p>
          ) : null}

          {section === "host" && supportsOperation(HOST_ADMIN_OPERATION_FORCE_ARCHETYPE) ? (
            <section className="adminPanel adminOperationPanel">
              <div className="adminOperationHeader">
                <h3>{t("admin.forceArchetype")}</h3>
              </div>
              {stationGroups.length ? (
                <div className="adminSection">
                  <h4>Station</h4>
                  <div className="adminStationCards" role="radiogroup" aria-label="Station">
                    {stationGroups.map(group => (
                      <button key={group.id} type="button" role="radio" aria-checked={selectedStationGroup?.id === group.id}
                        className={`adminStationCard ${selectedStationGroup?.id === group.id ? "isSelected" : ""}`}
                        onClick={() => setForceArchetypeStationId(group.targets.find(target => target.id === forceArchetypeStationId)?.id ?? group.targets[0].id)}>
                        <strong>{group.name}</strong>
                        <span>{group.targets.length === 1 ? group.targets[0].language : `${group.targets.length} host languages`}</span>
                      </button>
                    ))}
                  </div>
                  {selectedStationGroup && selectedStationGroup.targets.some(target => target.language !== "Station default") ? (
                    <div className="adminStationLanguages">
                      <h5>Host language</h5>
                      <div className="adminChipRow" role="radiogroup" aria-label={`${selectedStationGroup.name} host language`}>
                        {selectedStationGroup.targets.map(target => (
                          <button key={target.id} type="button" className={`adminChip ${forceArchetypeStationId === target.id ? "adminChipActive" : ""}`} role="radio" aria-checked={forceArchetypeStationId === target.id} onClick={() => setForceArchetypeStationId(target.id)}>{target.language}</button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="adminOperationBody">
                {capabilities.archetypes.length === 0 && !isLoadingCapabilities ? (
                  <p>{t("admin.noArchetypes")}</p>
                ) : null}

                <label className="adminField">
                  <span>{t("admin.archetype")}</span>
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
                    <option value="">{t("admin.selectArchetype")}</option>
                    {capabilities.archetypes.map((archetype) => (
                      <option key={archetype} value={archetype}>
                        {toArchetypeLabel(archetype)}
                      </option>
                    ))}
                  </select>
                </label>

                {forceArchetypeCapability?.dryRunSupported ? (
                  <div className="adminToggleRow">
                    <button
                      className={`adminToggle ${forceArchetypeDryRun ? "adminToggleActive" : ""}`}
                      type="button"
                      onClick={() => setForceArchetypeDryRun((value) => !value)}
                      role="switch"
                      aria-checked={forceArchetypeDryRun}
                    >
                      <span className="adminToggleTrack" aria-hidden="true"><span /></span>
                      {t("admin.dryRun")}
                    </button>
                  </div>
                ) : null}

                {supportsTrackFocus ? (
                  <div className="adminSubsection">
                    <div>
                      <h5>{t("admin.trackFocus")}</h5>
                      <p>{t("admin.trackFocusDescription")}</p>
                    </div>
                    <div className="adminChipRow" role="radiogroup" aria-label={t("admin.trackFocus")}>
                      <button
                        className={`adminChip ${selectedTrackFocus === null ? "adminChipActive" : ""}`}
                        type="button"
                        onClick={() => setSelectedTrackFocus(null)}
                        role="radio"
                        aria-checked={selectedTrackFocus === null}
                      >
                        {t("admin.useServerDefault")}
                      </button>
                      {capabilities.trackFocusValues.map((trackFocus) => (
                        <button
                          key={trackFocus}
                          className={`adminChip ${selectedTrackFocus === trackFocus ? "adminChipActive" : ""}`}
                          type="button"
                          onClick={() => setSelectedTrackFocus(trackFocus)}
                          role="radio"
                          aria-checked={selectedTrackFocus === trackFocus}
                        >
                          {toTrackFocusLabel(trackFocus, t)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <button
                  className="authSubmitButton adminPrimaryButton"
                  type="button"
                  onClick={() => void runForceArchetype()}
                  disabled={!forceArchetypeStationId || !selectedArchetype || isLoadingCapabilities || Boolean(submittingOperation) || isPollingJob}
                >
                  {submittingOperation === HOST_ADMIN_OPERATION_FORCE_ARCHETYPE
                    ? t("common.submitting")
                    : isPollingJob && activeJob?.operation === HOST_ADMIN_OPERATION_FORCE_ARCHETYPE
                      ? t("admin.jobRunning")
                      : t("admin.runForceArchetype")}
                </button>
                {!forceArchetypeStationId || !selectedArchetype ? (
                  <p className="adminDisabledHint">{t("admin.selectStationAndArchetypeHint")}</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {section === "schedule" && supportsOperation(HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR) ? (
            <section className="adminPanel adminOperationPanel">
              <div className="adminOperationHeader">
                <h3>{t("admin.scheduleGenerator")}</h3>
                <p>{t("admin.scheduleGeneratorDescription")}</p>
              </div>

              {capabilities.stations.length ? (
                <div className="adminSection">
                  <h4>{t("admin.station")}</h4>
                  <div className="adminChipRow" role="radiogroup" aria-label={t("admin.station")}>
                    {capabilities.stations.map((stationId) => (
                      <button
                        key={stationId}
                        className={`adminChip ${scheduleGeneratorStationId === stationId ? "adminChipActive" : ""}`}
                        type="button"
                        onClick={() => setScheduleGeneratorStationId(stationId)}
                        role="radio"
                        aria-checked={scheduleGeneratorStationId === stationId}
                      >
                        {stationLabel(stationId)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="adminOperationBody">

                {(scheduleGeneratorCapability?.dryRunSupported || scheduleGeneratorCapability?.forceApplySupported) ? (
                  <div className="adminToggleRow">
                    {scheduleGeneratorCapability?.dryRunSupported ? (
                      <button
                        className={`adminToggle ${scheduleGeneratorDryRun ? "adminToggleActive" : ""}`}
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
                        role="switch"
                        aria-checked={scheduleGeneratorDryRun}
                      >
                        <span className="adminToggleTrack" aria-hidden="true"><span /></span>
                        {t("admin.dryRun")}
                      </button>
                    ) : null}
                    {scheduleGeneratorCapability?.forceApplySupported ? (
                      <button
                        className={`adminToggle ${scheduleGeneratorForceApply ? "adminToggleActive" : ""}`}
                        type="button"
                        onClick={() => setScheduleGeneratorForceApply((value) => !value)}
                        disabled={scheduleGeneratorDryRun}
                        role="switch"
                        aria-checked={scheduleGeneratorForceApply}
                      >
                        <span className="adminToggleTrack" aria-hidden="true"><span /></span>
                        {t("admin.forceApply")}
                      </button>
                    ) : null}
                  </div>
                ) : null}
                {scheduleGeneratorDryRun && scheduleGeneratorCapability?.forceApplySupported ? (
                  <p className="adminDisabledHint">{t("admin.forceApplyDisabledHint")}</p>
                ) : null}

                {scheduleGeneratorCapability?.supportedSeedModes.length ? (
                  <div className="adminSubsection">
                    <div>
                      <h5>{t("admin.seedMode")}</h5>
                      <p>{t("admin.seedModeDescription")}</p>
                    </div>
                    <div className="adminChipRow" role="radiogroup" aria-label={t("admin.seedMode")}>
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
                          role="radio"
                          aria-checked={normalizedScheduleSeedMode === seedMode}
                        >
                          {toSeedModeLabel(seedMode, t)}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {normalizedScheduleSeedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM ? (
                  <label className="adminField">
                    <span>{t("admin.customSeedKey")}</span>
                    <input value={scheduleGeneratorSeedSalt} onChange={(event) => setScheduleGeneratorSeedSalt(event.target.value)} />
                  </label>
                ) : null}

                {scheduleGeneratorCapability?.weekStartDateSupported ? (
                  <label className="adminField">
                    <span>{t("admin.weekStartDate")}</span>
                    <input type="date" value={scheduleGeneratorWeekStartDate} onChange={(event) => setScheduleGeneratorWeekStartDate(event.target.value)} />
                  </label>
                ) : null}

                {(supportsTuningField("open_ratio_min") ||
                  supportsTuningField("open_ratio_max") ||
                  supportsTuningField("min_open_slots") ||
                  supportsTuningField("max_open_slots") ||
                  supportsTuningField("min_block_minutes") ||
                  supportsTuningField("max_block_minutes")) ? (
                  <div className="adminSubsection">
                    <div>
                      <h5>{t("admin.tuning")}</h5>
                      <p>{t("admin.tuningDescription")}</p>
                    </div>
                    <div className="adminFieldGrid">
                      {supportsTuningField("open_ratio_min") ? (
                        <label className="adminField">
                          <span>{t("admin.openRatioMin")}</span>
                          <input value={scheduleGeneratorOpenRatioMin} onChange={(event) => setScheduleGeneratorOpenRatioMin(event.target.value)} inputMode="decimal" />
                        </label>
                      ) : null}
                      {supportsTuningField("open_ratio_max") ? (
                        <label className="adminField">
                          <span>{t("admin.openRatioMax")}</span>
                          <input value={scheduleGeneratorOpenRatioMax} onChange={(event) => setScheduleGeneratorOpenRatioMax(event.target.value)} inputMode="decimal" />
                        </label>
                      ) : null}
                      {supportsTuningField("min_open_slots") ? (
                        <label className="adminField">
                          <span>{t("admin.minOpenSlots")}</span>
                          <input value={scheduleGeneratorMinOpenSlots} onChange={(event) => setScheduleGeneratorMinOpenSlots(event.target.value)} inputMode="numeric" />
                        </label>
                      ) : null}
                      {supportsTuningField("max_open_slots") ? (
                        <label className="adminField">
                          <span>{t("admin.maxOpenSlots")}</span>
                          <input value={scheduleGeneratorMaxOpenSlots} onChange={(event) => setScheduleGeneratorMaxOpenSlots(event.target.value)} inputMode="numeric" />
                        </label>
                      ) : null}
                      {supportsTuningField("min_block_minutes") ? (
                        <label className="adminField">
                          <span>{t("admin.minBlockMinutes")}</span>
                          <input value={scheduleGeneratorMinBlockMinutes} onChange={(event) => setScheduleGeneratorMinBlockMinutes(event.target.value)} inputMode="numeric" />
                        </label>
                      ) : null}
                      {supportsTuningField("max_block_minutes") ? (
                        <label className="adminField">
                          <span>{t("admin.maxBlockMinutes")}</span>
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
                  disabled={!scheduleGeneratorStationId || isCustomSeedMissing || isLoadingCapabilities || Boolean(submittingOperation) || isPollingJob}
                >
                  {submittingOperation === HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR
                    ? t("common.submitting")
                    : isPollingJob && activeJob?.operation === HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR
                      ? t("admin.jobRunning")
                      : t("admin.runScheduleGenerator")}
                </button>
                {!scheduleGeneratorStationId ? <p className="adminDisabledHint">{t("admin.selectStationHint")}</p> : null}
                {isCustomSeedMissing ? <p className="adminDisabledHint">{t("admin.enterCustomSeed")}</p> : null}
              </div>
            </section>
          ) : null}

          {message ? (
            <p className={`playerError ${isAdminErrorMessage(message) ? "" : "adminMessageSuccess"}`}>
              {message}
            </p>
          ) : null}

          </div>
          <aside className="adminActivity" aria-label="Job activity">
            <div className="adminActivityHeading"><span className={`adminLiveDot ${isPollingJob ? "isLive" : ""}`} /><h3>Job activity</h3><span>{isPollingJob ? "Following live" : "Ready"}</span></div>
            {activeJob ? <>
              <div className="adminActivityTools"><small>{lastUpdated ? `Updated ${lastUpdated}` : "Waiting for first update"}</small><button type="button" className="adminGhostButton" onClick={() => { setIsPollingJob(true); setPollRevision(value => value + 1); }}>Reconnect</button></div>
              {pollError ? <p className="adminStatusNotice adminStatusNoticeError" role="status">{pollError}</p> : null}
              <HostAdminJobPanel job={activeJob} isPolling={isPollingJob} />
            </> : <div className="adminActivityEmpty"><span aria-hidden="true">⌁</span><h4>A front-row seat to your next job.</h4><p>Queue a segment or generate a schedule. Progress and logs will appear here automatically.</p></div>}
          </aside>
        </div>
      )}
    </div></div>
  );
}

function HostAdminJobPanel({ job, isPolling }: { job: HostAdminJob; isPolling: boolean }) {
  const statusLabel = toStatusLabel(job.status, t);
  const scheduleLines = job.scheduleOptions
    ? [
        job.scheduleOptions.forceApply ? t("admin.forceApplyEnabled") : null,
        job.scheduleOptions.seedMode ? t("admin.seedModeLine", { value: toSeedModeLabel(job.scheduleOptions.seedMode, t) }) : null,
        job.scheduleOptions.seedSalt
          ? job.scheduleOptions.seedMode === HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM
            ? t("admin.customSeedLine", { value: job.scheduleOptions.seedSalt })
            : t("admin.seedSaltLine", { value: job.scheduleOptions.seedSalt })
          : null,
        job.scheduleOptions.weekStartDate ? t("admin.weekStartLine", { value: job.scheduleOptions.weekStartDate }) : null,
        job.scheduleOptions.openRatioMin !== undefined ? t("admin.openRatioMinLine", { value: job.scheduleOptions.openRatioMin }) : null,
        job.scheduleOptions.openRatioMax !== undefined ? t("admin.openRatioMaxLine", { value: job.scheduleOptions.openRatioMax }) : null,
        job.scheduleOptions.minOpenSlots !== undefined ? t("admin.minOpenSlotsLine", { value: job.scheduleOptions.minOpenSlots }) : null,
        job.scheduleOptions.maxOpenSlots !== undefined ? t("admin.maxOpenSlotsLine", { value: job.scheduleOptions.maxOpenSlots }) : null,
        job.scheduleOptions.minBlockMinutes !== undefined ? t("admin.minBlockMinutesLine", { value: job.scheduleOptions.minBlockMinutes }) : null,
        job.scheduleOptions.maxBlockMinutes !== undefined ? t("admin.maxBlockMinutesLine", { value: job.scheduleOptions.maxBlockMinutes }) : null
      ].filter(Boolean)
    : [];

  return (
    <section className="adminPanel adminConsoleStack">
      <div className="adminPanelHeader">
        <div>
          <h3>{t("admin.latestHostJob")}</h3>
          <p>
            {stationLabel(job.station)} · {toOperationLabel(job.operation, t)}
          </p>
        </div>
        <span className={`adminJobBadge adminJobBadge${toStatusClassName(job.status)}`}>
          {isPolling && !isTerminalJobStatus(job.status) ? t("admin.polling") : statusLabel}
        </span>
      </div>

      {job.archetype ? <p>{t("admin.archetypeLine", { value: toArchetypeLabel(job.archetype) })}</p> : null}
      {job.trackFocus ? <p>{t("admin.focusLine", { value: toTrackFocusLabel(job.trackFocus, t) })}</p> : null}
      {job.dryRun ? <p>{t("admin.modeDryRun")}</p> : null}
      {scheduleLines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {job.exitCode !== undefined ? <p>{t("admin.exitCodeLine", { value: job.exitCode })}</p> : null}
      {job.acceptedAt ? <p>{t("admin.acceptedAtLine", { value: job.acceptedAt })}</p> : null}
      {job.startedAt ? <p>{t("admin.startedAtLine", { value: job.startedAt })}</p> : null}
      {job.finishedAt ? <p>{t("admin.finishedAtLine", { value: job.finishedAt })}</p> : null}
      <pre className="adminLogTail" tabIndex={0} aria-label="Job logs">{job.logTail?.trim() || "Waiting for log output…"}</pre>
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

function isAdminErrorMessage(message: string) {
  const normalized = message.toLowerCase();
  return ["failed", "unable", "invalid", "error"].some((term) => normalized.includes(term));
}

function buildJobStatusMessage(job: HostAdminJob, t: AdminText) {
  const operationLabel = toOperationLabel(job.operation, t);

  if (job.status.toLowerCase() === "succeeded") {
    return t("admin.jobCompleted", { operation: operationLabel, station: job.station });
  }

  return t("admin.jobFailed", {
    operation: operationLabel,
    station: job.station,
    suffix: job.exitCode !== undefined ? ` (${t("admin.exitCodeLine", { value: job.exitCode })})` : ""
  });
}

function stationLabel(stationId: string) {
  const directStation = STATIONS.find((station) => station.id === stationId);
  if (directStation) {
    return directStation.name;
  }

  const separatorIndex = stationId.lastIndexOf("-");
  if (separatorIndex > 0) {
    const brandId = stationId.slice(0, separatorIndex);
    const locale = stationId.slice(separatorIndex + 1);
    const brand = STATIONS.find((station) => station.id === brandId);
    if (brand && locale) {
      return `${brand.name} (${locale.toUpperCase()})`;
    }
  }

  return humanize(stationId);
}

function toArchetypeLabel(value: string) {
  return humanize(value);
}

function toTrackFocusLabel(value: string, t: AdminText) {
  if (value === "current") {
    return t("admin.focusCurrent");
  }

  if (value === "next") {
    return t("admin.focusNext");
  }

  return humanize(value);
}

function toSeedModeLabel(value: string, t: AdminText) {
  if (value === "stable_week") {
    return t("admin.seedStableWeek");
  }

  if (value === "fresh") {
    return t("admin.seedFresh");
  }

  if (value === "custom") {
    return t("admin.seedCustom");
  }

  return humanize(value);
}

function toOperationLabel(value: string, t: AdminText) {
  if (value === HOST_ADMIN_OPERATION_FORCE_ARCHETYPE) {
    return t("admin.forceArchetype");
  }

  if (value === HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR) {
    return t("admin.scheduleGenerator");
  }

  return humanize(value);
}

function toStatusLabel(value: string, t: AdminText) {
  switch (value.toLowerCase()) {
    case "accepted":
      return t("admin.statusAccepted");
    case "running":
      return t("admin.statusRunning");
    case "succeeded":
      return t("admin.statusSucceeded");
    default:
      return t("admin.statusFailed");
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
