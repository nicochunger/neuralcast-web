# NeuralCast Web PWA

Standalone Next.js website and PWA for the public NeuralCast radio experience.

## MVP

- Play NeuralCast and NeuralForge from the public live MP3 streams.
- Poll same-origin API routes for now-playing metadata and listener counts.
- Show a compact daily schedule derived from the public AzuraCast schedule API.
- Register a production service worker and expose a PWA manifest with install icons.
- Avoid private admin controls and credentialed endpoints.

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

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
- `https://neuralcast.duckdns.org/api/station/{stationId}/schedule?rows=300&now={isoOffsetDateTime}`

Song requests are intentionally left for a later phase.
