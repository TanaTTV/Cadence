import type { GeneratedSpeech, SpeechGenerationInput, Voice } from "@/types/audio";

export interface VoiceProvider {
  readonly id: string;
  listVoices(): Promise<Voice[]>;
  generateSpeech(input: SpeechGenerationInput): Promise<GeneratedSpeech>;
}
