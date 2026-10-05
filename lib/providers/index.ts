import "server-only";
import { ElevenLabsProvider } from "./elevenlabs";
import type { VoiceProvider } from "./voice-provider";

export function getVoiceProvider(): VoiceProvider { return new ElevenLabsProvider(); }
