import { getVoiceProvider } from "@/lib/providers";
import { assertLocalRequest, errorResponse, readSpeechInput } from "@/lib/server/http";

export async function POST(request: Request) {
  try {
    assertLocalRequest(request, true);
    const input = await readSpeechInput(request);
    const audio = await getVoiceProvider().generateSpeech(input);
    return new Response(audio.bytes, { headers: {
      "Content-Type": audio.mimeType, "Cache-Control": "no-store",
      "X-Asset-Id": audio.id, "X-Audio-Provider": audio.provider, "X-Audio-Model": audio.model,
      "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) { return errorResponse(error); }
}
