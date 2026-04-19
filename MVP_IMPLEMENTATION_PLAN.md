# NeuralCast Website and PWA MVP Implementation Plan

## Core Idea

Build a standalone website and Progressive Web App for NeuralCast, a two-station AI/curated radio project. The web app should let listeners open the site on desktop, Android, and iOS, press Play, switch between stations, see current station context, and install the site to their home screen as a lightweight app.

This repository is intentionally separate from the existing Android app repository:

- Existing Android app repo: `app_neuralcast`
- New web/PWA repo: `neuralcast-web-pwa`

The web app should not try to replace the native Android app immediately. It should provide a low-friction public listening experience that deploys easily to Vercel and works everywhere a browser works.

## Existing NeuralCast Context

NeuralCast already exists as a native Android app. The Android app is a single-module Kotlin/Jetpack Compose Material 3 radio app using AndroidX Media3 for audio playback, foreground playback service, media notifications, lock-screen controls, Android Auto browsing, settings, schedules, song requests, and admin workflows.

The public web MVP should borrow the user-facing ideas from the Android app, but it should avoid Android-only features and private/admin functions in the first release.

Current Android app package:

```text
com.neuralcast.radioplayer
```

Current Android app name:

```text
NeuralCast
```

Current stations are defined in the Android app at:

```text
app/src/main/java/com/neuralcast/radioplayer/data/StationProvider.kt
```

## Station Data

The MVP must support two stations.

### NeuralCast

- ID: `neuralcast`
- Name: `NeuralCast`
- Stream URL: `https://neuralcast.duckdns.org/listen/neuralcast/radio.mp3`
- Timezone: `Europe/Zurich`
- Existing Android background asset: `app/src/main/res/drawable/neuralcast_bg.webp`
- Existing Android artwork asset: `app/src/main/res/drawable/neuralcast_art.webp`

### NeuralForge

- ID: `neuralforge`
- Name: `NeuralForge`
- Stream URL: `https://neuralcast.duckdns.org/listen/neuralforge/radio.mp3`
- Timezone: `Europe/Zurich`
- Existing Android background asset: `app/src/main/res/drawable/neuralforge_bg.webp`
- Existing Android artwork asset: `app/src/main/res/drawable/neuralforge_art.webp`
- Android app treats schedules with 10 or more simultaneous active playlist names as `OpenRotation`.

## Known Public Endpoints

Base host:

```text
https://neuralcast.duckdns.org
```

Live stream endpoints:

```text
https://neuralcast.duckdns.org/listen/neuralcast/radio.mp3
https://neuralcast.duckdns.org/listen/neuralforge/radio.mp3
```

Now-playing/listener endpoint pattern:

```text
https://neuralcast.duckdns.org/api/nowplaying/{stationId}
```

Examples:

```text
https://neuralcast.duckdns.org/api/nowplaying/neuralcast
https://neuralcast.duckdns.org/api/nowplaying/neuralforge
```

The Android app currently reads listener count from this payload:

- Prefer `listeners.current`
- Fall back to `listeners.total`
- Clamp to `0` or greater

The same endpoint may also expose now-playing metadata, depending on the AzuraCast response shape. The web implementation should inspect the payload in browser/devtools or server logs and use the most reliable available fields. Common AzuraCast fields to check are:

- `now_playing.song.text`
- `now_playing.song.artist`
- `now_playing.song.title`
- `station.name`
- `listeners.current`
- `listeners.total`

Schedule endpoint pattern:

```text
https://neuralcast.duckdns.org/api/station/{stationId}/schedule?rows=300&now={urlEncodedIsoOffsetDateTime}
```

Examples:

```text
https://neuralcast.duckdns.org/api/station/neuralcast/schedule?rows=300&now=2026-04-19T00%3A00%3A00%2B02%3A00
https://neuralcast.duckdns.org/api/station/neuralforge/schedule?rows=300&now=2026-04-19T00%3A00%3A00%2B02%3A00
```

The `now` value should be the start of the selected day in `Europe/Zurich`, encoded as ISO offset datetime.

The Android app parses schedule entries from an array where each entry may contain:

- `title`
- `name`
- `description`
- `start`
- `end`

It uses the first non-empty title-like field in this order:

1. `title`
2. `name`
3. `description`

Song request endpoint pattern:

```text
https://neuralcast.duckdns.org/api/station/{stationId}/requests
```

Examples:

```text
https://neuralcast.duckdns.org/api/station/neuralcast/requests
https://neuralcast.duckdns.org/api/station/neuralforge/requests
```

The Android app expects each requestable song entry to include:

- `request_id` or `id`
- `request_url`
- `song.text`
- `song.artist`
- `song.title`

Submitting a request is done by issuing a GET request to the returned `request_url`. That URL can be absolute or relative to `https://neuralcast.duckdns.org`.

Song requests are useful, but they are not required for the very first MVP if they slow down delivery.

## Non-MVP / Private Context

The Android app includes admin and host-orchestrator features, including skip-track controls and host-side workflow configuration. These should not be included in the public web MVP unless explicitly requested later.

Do not expose admin API keys, skip-track actions, backend orchestration controls, or any credentialed AzuraCast endpoints in the public website.

## Recommended Stack

Use Next.js for the first implementation.

Reasoning:

- Vercel hosts Next.js with minimal configuration.
- The site may grow into station pages, schedule pages, metadata routes, SEO pages, and possibly server-side proxy routes.
- Next.js gives clean routing and metadata management while still allowing a mostly static public site.
- Vercel preview deployments will make it easy to review changes from branches or pull requests.

Recommended baseline:

```text
Next.js
TypeScript
React
CSS Modules or plain global CSS
PWA manifest and service worker
```

Avoid adding a large design system for the MVP. Keep the codebase small and direct.

## Vercel Deployment Requirements

The repo should be deployable by importing it into Vercel.

Expected setup:

- Framework preset: `Next.js`
- Build command: `npm run build`
- Install command: `npm install`
- Output directory: Vercel should auto-detect for Next.js
- Node version: use Vercel default unless the project later needs a pinned version

Deployment should work from a clean clone with:

```bash
npm install
npm run build
```

The production site must be served over HTTPS. Vercel provides HTTPS automatically.

## PWA Requirements

The website should be installable as a PWA where browsers support it.

Add:

- `public/manifest.webmanifest`
- App icons in multiple sizes
- Apple touch icon
- Theme color metadata
- Mobile viewport metadata
- `display: standalone`
- `start_url: /`
- `scope: /`
- A service worker for basic offline shell/fallback behavior

The MVP does not need full offline radio playback. Live streams require network. Offline behavior should simply load a friendly fallback/shell and explain that listening requires a connection.

iOS-specific considerations:

- Users install through Add to Home Screen.
- Use Apple touch icon metadata.
- Use safe-area CSS variables for top/bottom insets.
- Do not rely on autoplay.
- Validate background audio behavior on real iOS hardware.

Android-specific considerations:

- Chrome and other Android browsers can prompt install when PWA criteria are met.
- Keep tap targets large.
- Use Media Session API where supported for lock-screen metadata/control integration.

## Audio Playback Requirements

Use a single HTML audio element managed by React state.

Important browser behavior:

- Do not autoplay audio on page load.
- Playback should begin only after a user taps/clicks Play.
- Handle `play()` promise rejection and show a useful message.
- Show buffering, playing, paused/stopped, and error states.
- Keep the player stable when switching stations.

The player should support:

- Play selected station
- Stop/pause current stream
- Switch station
- Display active station name
- Display now-playing text when available
- Display listener count when available
- Update Media Session metadata when available

Media Session API:

- Set title to the current track when available.
- Set artist/station to the active station.
- Set artwork to station artwork or PWA icon.
- Register play/pause/stop handlers where browser support exists.
- Treat Media Session as progressive enhancement, not a required feature.

## Metadata Polling

Poll the now-playing endpoint for each station.

Suggested MVP behavior:

- Fetch immediately on page load.
- Poll every 20-30 seconds while the page is visible.
- Reduce or pause polling when the page is hidden.
- Refresh immediately after the user changes active station.

Handle failures gracefully:

- Do not break playback if metadata fetch fails.
- Show `Waiting for live metadata.` or `Metadata unavailable.`
- Keep the last known now-playing value for a short time if appropriate.

## Schedule MVP

Include a compact schedule preview if feasible in the first pass.

Minimum schedule behavior:

- Show `Live now` for each station using today's schedule.
- Show `Up next` if a later segment can be derived.
- Link or button to a simple schedule view for the selected station.

Schedule parsing should follow the Android app's behavior:

- Query the schedule endpoint with `rows=300`.
- Use the selected date's start-of-day in `Europe/Zurich` as the `now` parameter.
- Keep only entries that overlap the selected day.
- Build time segments from entry start/end boundaries.
- If no active entries exist for a time range, mark it as an open slot.
- For NeuralForge, if active playlist names are at least 10, show that segment as open rotation.
- Merge adjacent segments with the same type and same playlist list.

If schedule implementation is too much for the first PR, document it as the next task and ship the player plus station metadata first.

## Song Requests

Song request support is a good second-phase feature.

If implemented in the MVP:

- Add a Request button per station.
- Fetch `/api/station/{stationId}/requests`.
- Show searchable list by artist/title/text.
- Submit by calling the returned `request_url`.
- Show success/error feedback.
- Disable repeat clicks during submission.

If not implemented in the MVP:

- Keep the UI free of inactive Request buttons.
- Leave endpoint details in documentation for the next implementation step.

## Proposed MVP Screens

The first screen should be the working radio experience, not a marketing landing page.

Desktop layout:

- Header with NeuralCast name and concise station identity.
- Main content with two station panels.
- Each station panel includes artwork/background, station name, Play/Stop, now-playing, listener count, and schedule summary.
- A persistent mini-player can appear when audio is active.
- Footer with basic project/station links if available.

Mobile layout:

- Station panels stacked vertically.
- Large Play/Stop controls.
- Bottom mini-player when a station is active.
- Thumb-friendly station switching.
- Safe-area padding for iOS home indicator.

Installed PWA layout:

- App should feel like a compact radio app.
- Avoid browser-only assumptions.
- Keep navigation shallow.
- Maintain state on reload where useful, such as last selected station.

## Design Direction

Use the Android app as conceptual reference, not a one-to-one visual copy.

Current Android UI patterns:

- Material 3 structure
- Large station cards
- Background artwork per station
- Overlay gradient for text readability
- `On air` / `Buffering` state chips
- Now-playing surface inside station card
- Schedule and Request actions
- Recently played list

For the web MVP:

- Use real station imagery/artwork where possible.
- Keep text readable over image backgrounds.
- Keep controls stable and large enough on phones.
- Use a distinct radio-app feel rather than a generic corporate landing page.
- Do not make the first page a pure marketing hero. The first view should let the user listen.

Existing Android assets that may be reused or adapted:

```text
app/src/main/res/drawable/neuralcast_bg.webp
app/src/main/res/drawable/neuralforge_bg.webp
app/src/main/res/drawable/neuralcast_art.webp
app/src/main/res/drawable/neuralforge_art.webp
app/src/main/res/drawable/neuralcast_icon.png
```

If reusing them, copy assets intentionally into this web repo under `public/images/` or `public/icons/`. Do not reference files from the Android repo at runtime.

## Suggested File Structure

```text
neuralcast-web-pwa/
  README.md
  MVP_IMPLEMENTATION_PLAN.md
  package.json
  next.config.ts
  public/
    manifest.webmanifest
    icons/
    images/
  src/
    app/
      layout.tsx
      page.tsx
      globals.css
    components/
      AudioPlayer.tsx
      StationCard.tsx
      MiniPlayer.tsx
      SchedulePreview.tsx
    lib/
      stations.ts
      azuracast.ts
      schedule.ts
      mediaSession.ts
    types/
      radio.ts
```

## Suggested Implementation Order

1. Scaffold Next.js with TypeScript.
2. Add station constants with IDs, names, stream URLs, timezone, and image paths.
3. Build the main radio page with two station cards.
4. Implement shared audio playback with one audio element.
5. Add now-playing/listener polling.
6. Add Media Session metadata as progressive enhancement.
7. Add responsive CSS for desktop/mobile/PWA safe areas.
8. Add manifest, icons, theme color, and basic service worker.
9. Add schedule preview if scope allows.
10. Add deployment README with Vercel instructions.

## Acceptance Criteria

The MVP is ready when:

- `npm install` succeeds from a clean clone.
- `npm run build` succeeds.
- The app plays both NeuralCast and NeuralForge after a user tap/click.
- Switching stations stops or replaces the previous stream cleanly.
- Metadata/listener failures do not break playback.
- Layout works at phone, tablet, and desktop widths.
- The app has a valid manifest and installable PWA basics.
- Vercel can deploy the repo without custom build hacks.
- No private/admin credentials or controls are exposed.

## Open Questions For The Implementing Agent

- What domain will be attached in Vercel?
- Should the public site include song requests in MVP or phase two?
- Should the first release include full schedule pages or only live/up-next summaries?
- Should existing Android artwork be copied into this repo, or should new web-specific images/icons be generated?
- Should a future version wrap the PWA for app stores using Capacitor or Android Trusted Web Activity?

## First Build Target

Prioritize a working public listener:

> Open the site, tap Play on NeuralCast or NeuralForge, hear the stream, see what is playing, and install the site to the home screen.

