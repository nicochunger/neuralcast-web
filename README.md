# NeuralCast Web PWA

Standalone Next.js website and PWA for the public NeuralCast radio experience.

## MVP

- Play NeuralCast and NeuralForge from the public live MP3 streams.
- Poll same-origin API routes for now-playing metadata and listener counts.
- Show a compact daily schedule derived from the public AzuraCast schedule API.
- Register a production service worker and expose a PWA manifest with install icons.
- Provide a private admin sign-in flow for future control-room actions.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### Admin Authentication

The app now includes a private admin login at `/login` and a protected admin area at `/admin`.

Create a local `.env.local` file from `.env.example` and set:

- `NEXTAUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `AZURACAST_ADMIN_API_KEY`
- `HOST_ADMIN_BASE_URL`
- `HOST_ADMIN_TOKEN`

To generate a bcrypt password hash:

```bash
node -e 'const bcrypt=require("bcryptjs"); bcrypt.hash(process.argv[1], 12).then(console.log)' "your-password"
```

On Vercel, add the same four environment variables in the project settings before deploying.

`AZURACAST_ADMIN_API_KEY` is used server-side for protected control-room actions like skipping the current track, and is never exposed to the browser.
`HOST_ADMIN_BASE_URL` and `HOST_ADMIN_TOKEN` are used server-side for the host orchestrator console, including force-archetype and schedule-generator jobs.
They also power the authenticated favorites sync: the PWA route `/api/favorites` forwards admin requests to the VPS route `/admin/favorites`.

Favorites for public listeners are stored in browser local storage. Favorites for the admin account are mirrored through the VPS admin service and persisted at `/root/projects/NeuralCast/runtime/admin_http/favorites.json` on the NeuralCast host. The VPS service writes that file atomically under a lock; Vercel does not write favorites to its own filesystem.

## Build

```bash
npm run build
npm run start
```

## Vercel

Import this repository into Vercel with the Next.js framework preset.

- Install command: `npm install`
- Build command: `npm run build`
- Output directory: auto-detected by Vercel

HTTPS is required for PWA installation and browser media behavior; Vercel provides it automatically.

## Public Endpoints Used

- `https://neuralcast.duckdns.org/listen/neuralcast/radio.mp3`
- `https://neuralcast.duckdns.org/listen/neuralforge/radio.mp3`
- `https://neuralcast.duckdns.org/api/nowplaying/{stationId}`
- `https://neuralcast.duckdns.org/api/station/{stationId}/schedule?rows=1000&now={isoOffsetDateTime}`

Song requests are intentionally left for a later phase.

## Host companion cards

Each station card has a Host recap button, enabled with an accent dot while a
recap is available and greyed out otherwise. It opens a popup with reading cards
for news, concert checks, short stories, album
spotlights, era snapshots, and deep dives. Cards follow the selected station and
host channel, with optional full transcripts. Editorial text stays in the host
language; interface labels follow the app language.

The public `/api/host-companion/{stationId}?channel={channelId}` route uses the
existing server-only `HOST_ADMIN_BASE_URL` and `HOST_ADMIN_TOKEN` to read
`/admin/host-channels/{channelId}/companion` from NeuralCast. Unknown or mismatched
station/channel pairs are rejected. Missing configuration hides the card.

Queue insertion establishes publication. Cards appear at estimated snippet start
and expire 20 minutes after estimated end, or when a newer eligible segment
starts. The player polls every 15 seconds. Opening the popup keeps that recap
available until dismissed, even after expiry or replacement. Changing its host
language closes it. The popup uses the existing Escape, backdrop dismissal, focus
trap, and focus restoration behavior. Both station buttons update independently
without switching playback. Backend outages never
interrupt audio. Existing host segments are not retroactively summarized.

Run `npm run build`, then `npm run check:host-companion` for an offline
production-route check using a local fixture backend. This checks channel
isolation, server-side authentication, null/malformed responses, and outage
handling without calling live stations. `npm run check:audio-persistence` verifies
the persistent audio architecture.

### Authored episode guides

Manually produced episodes use the same Host recap popup; there is no episode
review page. When an approved episode is identified by its now-playing song ID,
the popup shows its premise, a chapter timeline, small track cards with embedded
album-art thumbnails, selection notes, and commentary summaries/sources. It
highlights the current chapter using measured render offsets and the player's
existing corrected server clock. Buffering can introduce a small audible offset.

The normalized now-playing/history responses retain `songId`. Companion requests
forward at most nine channel-specific current/recent observations; no extra
AzuraCast polling is added. An active episode takes priority over ordinary recaps.
Its guide remains available for 20 minutes after the end unless a newer eligible
recap replaces it. Artwork comes through `/api/episode-art/...`, which proxies the
VPS endpoint server-side without exposing admin credentials. Missing artwork uses
the station image. Only explicitly approved episodes are published by the backend;
rendered/uploaded previews never appear in listener guides.


## On-demand episodes

`/episodes` opens the Podcasts destination under the shared Live radio / Podcasts navigation.
A central selector switches between the independent NeuralCast and NeuralForge
series (`/episodes?station=<station>`); each series lists numbered episode rows
with the newest first. Numbers follow publication order within each station. Individual
pages use `/episodes/<station>/<episode-id>`. Metadata uses the existing server-only
`HOST_ADMIN_BASE_URL`; it must point to the browser-reachable HTTPS VPS proxy in
production (currently `/admin-http`). No additional credentials are exposed.
Audio and artwork are served directly by that VPS, not through Vercel functions.

Publication is a separate manual command in NeuralCast's episode producer; a
preview upload or radio queue request does not publish a website episode. See
`docs/episode_producer.md` in that repository. The guide and artwork are permanent
publication assets. RSS is not part of this version.

The on-demand audio element is mounted in the root layout, separately from the
unchanged persistent live-radio element. `EpisodePlayerProvider` owns it, saves
resume positions locally per revision, and coordinates exclusive playback with
`AudioPlayerProvider`. Internal navigation must continue using Next links.

After `npm run build`, run `npm run check:audio-persistence`,
`npm run check:host-companion`, and `npm run check:episode-playback`. The last
check requires Playwright and Chromium. For an existing external installation,
set `EPISODE_PLAYWRIGHT_MODULE` to its module path. It generates synthetic tones,
uses a localhost fixture, and never publishes or plays real station media.
