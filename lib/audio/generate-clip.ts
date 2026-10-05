import type { AudioAsset } from "@/types/audio";
import type { BrowserAudio } from "./browser-audio";

export async function generateClip(engine: BrowserAudio, input: { voiceId: string; text: string }): Promise<{ asset: AudioAsset; buffer: AudioBuffer }> {
  const response = await fetch("/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
  if (!response.ok) { const data = await response.json(); throw new Error(data.error ?? "Speech generation failed."); }
  const bytes = await response.arrayBuffer();
  const buffer = await engine.decode(bytes);
  const asset: AudioAsset = {
    id: response.headers.get("X-Asset-Id") ?? crypto.randomUUID(),
    url: URL.createObjectURL(new Blob([bytes], { type: response.headers.get("Content-Type") ?? "audio/mpeg" })),
    duration: buffer.duration,
    provider: response.headers.get("X-Audio-Provider") ?? "unknown",
    model: response.headers.get("X-Audio-Model") ?? "unknown",
    metadata: { ...input, text: input.text.trim(), createdAt: new Date().toISOString() },
  };
  return { asset, buffer };
}
