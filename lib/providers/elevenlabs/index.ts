import "server-only";
import { ProviderError } from "../errors.ts";
import type { VoiceProvider } from "../voice-provider";
import type { GeneratedSpeech, SpeechGenerationInput, Voice } from "@/types/audio";

export class ElevenLabsProvider implements VoiceProvider {
  readonly id = "elevenlabs";
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fetcher: typeof fetch;

  constructor(options: { apiKey?: string; model?: string; fetcher?: typeof fetch } = {}) {
    this.apiKey = (options.apiKey ?? process.env.ELEVENLABS_API_KEY ?? "").trim();
    this.model = options.model ?? process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2";
    this.fetcher = options.fetcher ?? fetch;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    if (!this.apiKey) throw new ProviderError("Add ELEVENLABS_API_KEY to .env.local, then restart the app.", 503);
    let response: Response;
    try {
      response = await this.fetcher(`https://api.elevenlabs.io${path}`, {
        ...init, cache: "no-store", signal: AbortSignal.timeout(60_000),
        headers: { "xi-api-key": this.apiKey, ...init.headers },
      });
    } catch {
      throw new ProviderError("Voice provider could not be reached. Please retry.", 502);
    }
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? "Voice provider rejected the key or its permissions. Check .env.local."
        : response.status === 429 ? "Voice provider quota or rate limit reached. Please retry later."
        : "Voice provider could not complete the request. Check the voice and account settings.";
      // Never relay upstream bodies, which may contain credentials or private input.
      throw new ProviderError(message, response.status === 429 ? 429 : 502);
    }
    return response;
  }

  async listVoices(): Promise<Voice[]> {
    const voices: Voice[] = [];
    const tokens = new Set<string>();
    let token: string | undefined;
    do {
      const query = new URLSearchParams({ page_size: "100" });
      if (token) query.set("next_page_token", token);
      const response = await this.request(`/v2/voices?${query}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.voices)) throw new ProviderError("Voice provider returned an invalid voice list.", 502);
      for (const voice of data.voices) {
        if (typeof voice?.voice_id !== "string" || typeof voice?.name !== "string")
          throw new ProviderError("Voice provider returned an invalid voice.", 502);
        voices.push({ id: voice.voice_id, name: voice.name, provider: this.id });
      }
      if (!data.has_more) break;
      const nextToken: unknown = data.next_page_token;
      if (typeof nextToken !== "string" || !nextToken || tokens.has(nextToken) || tokens.size >= 100)
        throw new ProviderError("Voice provider returned invalid pagination.", 502);
      token = nextToken;
      tokens.add(nextToken);
    } while (token);
    return [...new Map(voices.map((voice) => [voice.id, voice])).values()];
  }

  async generateSpeech(input: SpeechGenerationInput): Promise<GeneratedSpeech> {
    const response = await this.request(`/v1/text-to-speech/${encodeURIComponent(input.voiceId)}?output_format=mp3_44100_128`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input.text, model_id: this.model }),
    });
    const bytes = await response.arrayBuffer();
    if (!bytes.byteLength || bytes.byteLength > 20_000_000 || !response.headers.get("content-type")?.startsWith("audio/"))
      throw new ProviderError("Voice provider returned invalid audio.", 502);
    return { id: crypto.randomUUID(), bytes, mimeType: "audio/mpeg", provider: this.id, model: this.model };
  }
}
