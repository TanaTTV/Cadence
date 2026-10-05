# Cadence

A local-first dialogue pacing experiment. Milestone 0.1 compares raw and AI-paced conversation; it is not a full DAW.

## Run locally

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The server binds to loopback for local use.

## Speech setup

Copy `.env.example` to `.env.local` (a blank local file is already created in the original checkout). Set `ELEVENLABS_API_KEY` locally, then restart the dev server. Never paste the key into chat or use a `NEXT_PUBLIC_` variable for it.

1. Click **Load voices**, choose a voice, and enter a dialogue line.
2. Click **Generate test clip**. This sends the text to ElevenLabs and uses your account credits.
3. Confirm the decoded duration appears, click **Play clip**, and listen to the complete line. Check **Stop** as well.

The key remains server-side. Provider-specific code is under `lib/providers/elevenlabs`; generic routes use the `VoiceProvider` interface. The integration follows the official [voice listing](https://elevenlabs.io/docs/api-reference/voices/search) and [speech generation](https://elevenlabs.io/docs/api-reference/text-to-speech/convert) APIs. Voice listing handles pagination. The browser decodes the returned audio using Web Audio and takes duration from that decoded buffer.

Generated audio and editor state currently stay in browser memory for this gate. Refreshing loses the clip. No audio or project data is uploaded to Cadence infrastructure, and no server audio files are written. Speech text does go to the chosen provider when generation is requested.

The one-clip gate has been verified with real Eleven v4 speech, decoded browser duration, and playback. The main screen now supports two characters, up to ten independent dialogue clips, a measured two-track timeline, and raw sequential playback. `/clip-test` retains the one-clip diagnostic screen.

The default speech model is `eleven_v4`. Override `ELEVENLABS_MODEL_ID` in `.env.local` to compare another model. Each clip records the model used for generation.

## Dialogue workflow

1. Load voices. The initial assignments prefer built-in Sarah and George voices; some library voices require a paid plan.
2. Edit the two character names and voices, then enter your scene (eight sample turns are included).
3. Generate Dialogue to generate missing clips sequentially. Each line can also be generated, regenerated, or played independently.
4. Review the actual durations and raw timeline. Editing a line or changing its speaker/voice invalidates its audio. If generation fails partway, completed clips remain available for retry.
5. Play Raw once all lines are generated. The clips are scheduled on one Web Audio clock with zero added gaps. Stop cancels the whole schedule.

The AI provider is undecided. AI planning, deterministic paced placement, Raw/Paced comparison, manual gaps, and export remain pending. This is an incremental implementation, not the finished Milestone 0.1.

## Development

```sh
npm run lint
npm run typecheck
npm run build
npm test
```

Environment files, generated audio, build output, temporary files, and local databases are ignored by Git.

Tests use mocked provider responses and do not use your API key or account credits. Browser playback must also be checked with real speech; synthetic audio only verifies decoding and playback mechanics.

At initialization, `npm audit` reports five high-severity findings in the ESLint development dependency chain (braces/micromatch/fast-glob). `npm audit --omit=dev` reports none. npm's proposed fix downgrades the Next.js lint configuration; no forced downgrade has been applied.

## Milestone sequence

1. Local app foundation.
2. Server-only voice provider, voice selection, one generated clip, browser playback, and decoded duration.
3. Multiple dialogue turns, timeline, and raw playback.
4. Validated semantic AI pacing plan and deterministic timeline placement.
5. Raw/Paced comparison, manual gaps, and WAV export.

Advance only after the preceding stage works. No cloud deployment is planned.
