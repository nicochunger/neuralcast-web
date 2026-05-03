export const HOST_ADMIN_OPERATION_FORCE_ARCHETYPE = "force_archetype";
export const HOST_ADMIN_OPERATION_SCHEDULE_GENERATOR = "schedule_generator";
export const HOST_ADMIN_SCHEDULE_SEED_MODE_STABLE_WEEK = "stable_week";
export const HOST_ADMIN_SCHEDULE_SEED_MODE_FRESH = "fresh";
export const HOST_ADMIN_SCHEDULE_SEED_MODE_CUSTOM = "custom";

export interface HostAdminOperationCapability {
  dryRunSupported: boolean;
  trackFocusSupported: boolean;
  forceApplySupported: boolean;
  weekStartDateSupported: boolean;
  supportedSeedModes: string[];
  defaultSeedMode?: string;
  supportedTuningFields: string[];
}

export interface HostAdminCapabilities {
  stations: string[];
  archetypes: string[];
  trackFocusValues: string[];
  trackFocusArchetypes: string[];
  operations: Record<string, HostAdminOperationCapability>;
}

export interface HostAdminScheduleOptions {
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
}

export interface HostAdminJob {
  jobId: string;
  operation: string;
  station: string;
  archetype?: string;
  trackFocus?: string;
  dryRun: boolean;
  scheduleOptions?: HostAdminScheduleOptions;
  status: string;
  acceptedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  logTail?: string;
}
