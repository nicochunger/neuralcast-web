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
