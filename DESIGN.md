# Radio Journal

Independent design exploration based on `0dbc80e`, on branch `design/radio-journal`.

## Preview

```sh
npm ci
npm run dev -- --port 3101
```

Use the existing environment settings for authenticated admin actions. Use separate ports to compare both worktrees at once. Nothing needs to be merged into the production branch. Production PWA installation requires HTTPS (or localhost) and a production build.

## Feature parity

The existing components and event handlers are retained: both stations; play/stop, buffering and reconnect; host language modes; metadata, listener counts, track progress and artwork lightbox; favorites and admin sync; history; schedule and details; searchable song requests and confirmations; volume/mute and persistent mini-player; three UI languages; light/dark/system preference; install prompt; About, login, sign-out and all admin operations including the independent test stream.

Only the presentation stylesheet, its import and localized home introduction change. Root audio placement, providers, routes, APIs and service worker are retained.

## Manual acceptance

- Check desktop and narrow mobile layouts in English, Spanish and French, and both themes.
- Play each station, change host language, adjust volume/mute and navigate to About and back; playback must continue.
- Open history, schedule/details, artwork, favorites and requests; verify keyboard focus, Escape and search.
- Sign in to verify synced favorites, skip, host operations and independent test playback using the configured backend.
- Check installation and playback on a real mobile device with a production preview.

## Validation performed

Production build (including TypeScript and audio-persistence architecture check) passed. Chromium checked both station cards at 1440, 390 and 320 pixels, six light/dark and language combinations at 320 pixels without page overflow or runtime page errors, opening favorites/history/schedule/requests and Escape dismissal, and retaining the audio DOM element across navigation to About. Live metadata loaded from the existing endpoints. Actual audible continuity, authenticated mutations and mobile installation remain manual acceptance checks.
