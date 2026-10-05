# Cadence

A local-first dialogue pacing experiment. Milestone 0.1 compares raw and AI-paced conversation; it is not a full DAW.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The server binds to loopback for local use.

## Development

```sh
npm run lint
npm run typecheck
npm run build
```

Environment files, generated audio, build output, temporary files, and local databases are ignored by Git.

## Milestone sequence

1. Local app foundation.
2. Server-only voice provider, voice selection, one generated clip, browser playback, and decoded duration.
3. Multiple dialogue turns, timeline, and raw playback.
4. Validated semantic AI pacing plan and deterministic timeline placement.
5. Raw/Paced comparison, manual gaps, and WAV export.

Advance only after the preceding stage works. No cloud deployment is planned.
