import "server-only";
import { ProviderError } from "../providers/errors.ts";

export function assertLocalRequest(request: Request, requireOrigin = false) {
  const url = new URL(request.url);
  // Next.js may normalize request.url to localhost even when Host is 127.0.0.1.
  // Validate the actual HTTP authority before comparing the browser's Origin.
  const authority = request.headers.get("host") || url.host;
  const actualUrl = new URL(`${url.protocol}//${authority}`);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(actualUrl.hostname))
    throw new ProviderError("This lab is intended for local use.", 403);
  const origin = request.headers.get("origin");
  if ((requireOrigin && !origin) || (origin && origin !== actualUrl.origin))
    throw new ProviderError("Only same-origin local requests are allowed.", 403);
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new ProviderError("Cross-site requests are not allowed.", 403);
}

export function errorResponse(error: unknown) {
  return Response.json({ error: error instanceof ProviderError ? error.message : "Request failed. Please retry." }, {
    status: error instanceof ProviderError ? error.status : 500,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readSpeechInput(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new ProviderError("Expected JSON input.", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new ProviderError("Missing speech input.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new ProviderError("Speech input is too large.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let data;
  try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new ProviderError("Invalid JSON input.", 400); }
  if (!data || typeof data.voiceId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.voiceId)
    || typeof data.text !== "string" || !data.text.trim() || data.text.length > 1000)
    throw new ProviderError("Choose a voice and enter 1–1000 characters of dialogue.", 400);
  return { voiceId: data.voiceId, text: data.text.trim() };
}
