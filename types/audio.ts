export interface Voice { id: string; name: string; provider: string }
export interface SpeechGenerationInput { voiceId: string; text: string }
export interface AudioAsset {
  id: string;
  url: string;
  duration: number;
  provider: string;
  model: string;
  metadata: { voiceId: string; text: string; createdAt: string };
}
// Duration is intentionally unknown until the browser decodes the real audio.
export interface GeneratedSpeech {
  id: string;
  bytes: ArrayBuffer;
  mimeType: string;
  provider: string;
  model: string;
}
