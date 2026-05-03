import type { HostAdminCapabilities, HostAdminJob, HostAdminOperationCapability, HostAdminScheduleOptions } from "@/types/hostAdmin";

const NETWORK_TIMEOUT_MS = 15_000;

export function isHostAdminConfigured() {
  return Boolean(process.env.HOST_ADMIN_BASE_URL?.trim() && process.env.HOST_ADMIN_TOKEN?.trim());
}

export async function getHostAdminCapabilities(): Promise<HostAdminCapabilities> {
  const payload = await requestHostAdminJson("GET", "/admin/capabilities");

  return {
    stations: readStringArray(payload.stations),
    archetypes: readStringArray(payload.archetypes),
    trackFocusValues: readStringArray(payload.track_focus_values),
    trackFocusArchetypes: readStringArray(payload.track_focus_archetypes),
    operations: readOperationCapabilities(payload.operations)
  };
}

export async function submitForceArchetype(input: {
  station: string;
  archetype: string;
  trackFocus?: string;
  dryRun?: boolean;
}) {
  const payload = await requestHostAdminJson("POST", "/admin/force-archetype", {
    station: input.station,
    archetype: input.archetype,
    dry_run: input.dryRun === true,
    ...(input.trackFocus ? { track_focus: input.trackFocus } : {})
  });

  const jobId = readString(payload.job_id);

  if (!jobId) {
    throw new Error("The admin API accepted the request but did not return a job ID.");
  }

  return jobId;
}

export async function submitScheduleGenerator(input: {
  station: string;
  dryRun?: boolean;
  forceApply?: boolean;
  seedMode?: string;
  seedSalt?: string;
  weekStartDate?: string;
  openRatioMin?: number;
  openRatioMax?: number;
  minOpenSlots?: number;
  maxOpenSlots?: number;
  minBlockMinutes?: number;
  maxBlockMinutes?: number;
}) {
  const payload = await requestHostAdminJson("POST", "/admin/run-schedule-generator", {
    station: input.station,
    dry_run: input.dryRun === true,
    force_apply: input.forceApply === true,
    ...(input.seedMode ? { seed_mode: input.seedMode } : {}),
    ...(input.seedSalt ? { seed_salt: input.seedSalt } : {}),
    ...(input.weekStartDate ? { week_start_date: input.weekStartDate } : {}),
    ...(input.openRatioMin !== undefined ? { open_ratio_min: input.openRatioMin } : {}),
    ...(input.openRatioMax !== undefined ? { open_ratio_max: input.openRatioMax } : {}),
    ...(input.minOpenSlots !== undefined ? { min_open_slots: input.minOpenSlots } : {}),
    ...(input.maxOpenSlots !== undefined ? { max_open_slots: input.maxOpenSlots } : {}),
    ...(input.minBlockMinutes !== undefined ? { min_block_minutes: input.minBlockMinutes } : {}),
    ...(input.maxBlockMinutes !== undefined ? { max_block_minutes: input.maxBlockMinutes } : {})
  });

  const jobId = readString(payload.job_id);

  if (!jobId) {
    throw new Error("The admin API accepted the request but did not return a job ID.");
  }

  return jobId;
}

export async function getHostAdminJobStatus(jobId: string): Promise<HostAdminJob> {
  const payload = await requestHostAdminJson("GET", `/admin/jobs/${encodeURIComponent(jobId)}`);

  return {
    jobId: readString(payload.job_id) ?? jobId,
    operation: readString(payload.operation) ?? "force_archetype",
    station: readString(payload.station) ?? "",
    archetype: readString(payload.archetype),
    trackFocus: readString(payload.track_focus),
    dryRun: payload.dry_run === true,
    scheduleOptions: readScheduleOptions(payload.schedule_options),
    status: readString(payload.status) ?? "unknown",
    acceptedAt: readString(payload.accepted_at),
    startedAt: readString(payload.started_at),
    finishedAt: readString(payload.finished_at),
    exitCode: typeof payload.exit_code === "number" ? payload.exit_code : undefined,
    logTail: readString(payload.log_tail)
  };
}

async function requestHostAdminJson(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
  const baseUrl = process.env.HOST_ADMIN_BASE_URL?.trim();
  const token = process.env.HOST_ADMIN_TOKEN?.trim();

  if (!baseUrl || !token) {
    throw new Error("Host admin API is not configured.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl.replace(/\/+$/, "")}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: controller.signal
    });
    const rawText = await response.text();

    if (!response.ok) {
      throw new Error(buildHostAdminErrorMessage(response.status, rawText));
    }

    return parseObject(rawText);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The host admin request timed out.");
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function buildHostAdminErrorMessage(status: number, rawText: string) {
  const payload = parseObject(rawText);
  const detail = payload?.detail;

  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }

  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    const message = readString((detail as Record<string, unknown>).message);

    if (message) {
      return message;
    }
  }

  const message = payload ? readString(payload.message) : undefined;

  if (message) {
    return message;
  }

  switch (status) {
    case 401:
      return "Invalid host admin token.";
    case 404:
      return "The requested host admin job was not found.";
    case 409:
      return "A host job is already running for this station.";
    case 422:
      return "The host admin request was invalid.";
    case 503:
      return "The host admin service is misconfigured.";
    default:
      return "Host admin request failed.";
  }
}

function readOperationCapabilities(value: unknown): Record<string, HostAdminOperationCapability> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).flatMap(([operation, capability]) => {
      if (!capability || typeof capability !== "object" || Array.isArray(capability)) {
        return [];
      }

      const payload = capability as Record<string, unknown>;

      return [[operation, {
        dryRunSupported: payload.dry_run_supported === true,
        trackFocusSupported: payload.track_focus_supported === true,
        forceApplySupported: payload.force_apply_supported === true,
        weekStartDateSupported: payload.week_start_date_supported === true,
        supportedSeedModes: readStringArray(payload.supported_seed_modes),
        defaultSeedMode: readString(payload.default_seed_mode),
        supportedTuningFields: readStringArray(payload.supported_tuning_fields)
      } satisfies HostAdminOperationCapability]];
    })
  );
}

function readScheduleOptions(value: unknown): HostAdminScheduleOptions | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const payload = value as Record<string, unknown>;

  return {
    forceApply: payload.force_apply === true,
    seedMode: readString(payload.seed_mode),
    seedSalt: readString(payload.seed_salt),
    weekStartDate: readString(payload.week_start_date),
    openRatioMin: typeof payload.open_ratio_min === "number" ? payload.open_ratio_min : undefined,
    openRatioMax: typeof payload.open_ratio_max === "number" ? payload.open_ratio_max : undefined,
    minOpenSlots: typeof payload.min_open_slots === "number" ? payload.min_open_slots : undefined,
    maxOpenSlots: typeof payload.max_open_slots === "number" ? payload.max_open_slots : undefined,
    minBlockMinutes: typeof payload.min_block_minutes === "number" ? payload.min_block_minutes : undefined,
    maxBlockMinutes: typeof payload.max_block_minutes === "number" ? payload.max_block_minutes : undefined
  };
}

function parseObject(rawText: string): Record<string, unknown> {
  if (!rawText.trim()) {
    return {};
  }

  const parsed = JSON.parse(rawText) as unknown;

  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
