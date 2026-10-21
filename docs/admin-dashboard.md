# Admin workspace

The authenticated `/admin` layout owns the console so switching between AI host,
scheduling, listeners, and preview routes preserves form values and job polling.
Live radio remains owned by the root audio provider.

The private workspace always uses English, independently of the public app locale.
Admin copy lives in `src/lib/adminCopy.ts`; there are no Spanish or French admin
translations. Capabilities load automatically on entry, with timed requests and
ten-second retries on failure. AI host targets are grouped by station, followed
by the available host languages; submissions retain the exact backend target ID.

Job status requests run sequentially, with a 20-second client timeout and retries
that back off from 8 to 30 seconds after failures. Successful requests restore the
four-second cadence. Returning to the tab or coming online triggers a refresh.
Terminal statuses (`succeeded`, `failed`) stop monitoring. Reconnect restarts it.
Job state lasts for the mounted admin workspace, not across a full page reload.
Run `node scripts/check-admin-polling.mjs` for the polling regression check.

## Listener reports

The server uses the existing `AZURACAST_ADMIN_API_KEY`. Its AzuraCast user must have
permission to view reports for the selected station. The key never reaches the
browser. `/api/admin/listeners` checks the admin session, validates the configured
channel and supported range, and returns responses with `private, no-store`.

AzuraCast's `/api/station/{station_id}/listeners` endpoint supports live reports
when `start` is absent, or history using `start` and `end`. We request `unique=true`,
so counts represent AzuraCast's grouped listeners, not raw connection sessions.
Average listening time is calculated from `connected_time` for those listeners.
History uses rolling 24-hour, 7-day, and 30-day windows with explicit UTC offsets.
Location availability and history retention depend on the AzuraCast installation.
Reports refresh every 15 seconds live and every minute for history. Errors retain
the previous successful report, visibly label it stale, and retry automatically.

Verified against upstream source:
- https://www.azuracast.com/docs/developers/apis/
- https://github.com/AzuraCast/AzuraCast/blob/main/backend/src/Controller/Api/Stations/ListenersAction.php
- https://github.com/AzuraCast/AzuraCast/blob/main/backend/src/Controller/Api/Traits/AcceptsDateRange.php

The production installation's API permissions, retention, and response data still
need a live authenticated check. No job was submitted during implementation.

## Music discovery

The Discovery tab provides five private audition recordings per station. Select
Yes or No and optionally explain either decision. Save feedback preserves a draft;
Process feedback saves and freezes all five decisions before launching a background
job. Only accepted recordings are added to station catalogs. Rejected auditions
are removed and written reasoning refines later recommendations. No additional
search or download runs while feedback is processed.

Generate suggestions starts a separate discovery job, or resumes failed preparation.
It is unavailable while a batch awaits review/processing. Weekly jobs also skip
pending batches. Job status is recovered from the backend after a page reload.
Preparation and processing failures can be retried without duplicating additions.

The server-only discovery helper uses existing HOST_ADMIN_BASE_URL/TOKEN settings.
The `/api/admin/discovery/[station]/[...action]` proxy checks the admin session on
all operations, including GET/HEAD audio, validates its station and route allowlist,
and checks Origin on mutations. It forwards byte ranges and streams audio without
revealing backend credentials or URLs. Private responses use no-store caching.
Audition audio elements are independent of live radio and pause only other audition
players. Unsaved feedback is never overwritten by polling; save before navigating.

Backend setup, weekly cron, retention, and recovery are documented in the NeuralCast
repository's `docs/music_discovery.md`. Deploy both applications for the feature.

Run `npm run check:discovery` for offline proxy authorization, feedback forwarding,
byte-range, cache, and error-isolation checks.
