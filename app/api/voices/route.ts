import { getVoiceProvider } from "@/lib/providers";
import { assertLocalRequest, errorResponse } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    assertLocalRequest(request);
    return Response.json({ voices: await getVoiceProvider().listVoices() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
