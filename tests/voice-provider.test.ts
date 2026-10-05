import assert from "node:assert/strict";
import { test } from "node:test";
import { ElevenLabsProvider } from "../lib/providers/elevenlabs/index.ts";
import { assertLocalRequest, errorResponse, readSpeechInput } from "../lib/server/http.ts";
import { validateDuration } from "../lib/audio/browser-audio.ts";

test("missing credential fails before making a network request", async () => {
  let called = false;
  const provider = new ElevenLabsProvider({ apiKey: "", fetcher: async () => { called = true; return new Response(); } });
  await assert.rejects(provider.listVoices(), /Add ELEVENLABS_API_KEY/);
  assert.equal(called, false);
});

test("voice listing paginates and removes duplicate ids", async () => {
  const paths: string[] = [];
  const provider = new ElevenLabsProvider({ apiKey: "test-placeholder", fetcher: async (url, init) => {
    paths.push(String(url));
    assert.equal((init?.headers as Record<string, string>)["xi-api-key"], "test-placeholder");
    return Response.json(paths.length === 1
      ? { voices: [{ voice_id: "a", name: "Maya" }], has_more: true, next_page_token: "second" }
      : { voices: [{ voice_id: "a", name: "Maya" }, { voice_id: "b", name: "David" }], has_more: false });
  } });
  assert.deepEqual((await provider.listVoices()).map((v) => v.id), ["a", "b"]);
  assert.match(paths[1], /next_page_token=second/);
});

test("malformed voice responses and repeated pagination tokens fail closed", async () => {
  for (const data of [{ voices: [{}] }, { voices: [] , has_more: true, next_page_token: "repeated" }, { wrong: [] }]) {
    const provider = new ElevenLabsProvider({ apiKey: "test-placeholder", fetcher: async () => Response.json(data) });
    await assert.rejects(provider.listVoices(), /invalid/);
  }
});

test("speech uses independent generation and never invents a duration", async () => {
  const provider = new ElevenLabsProvider({ apiKey: "test-placeholder", model: "test-model", fetcher: async (url, init) => {
    assert.match(String(url), /\/v1\/text-to-speech\/voice-a\?output_format=mp3_44100_128/);
    assert.deepEqual(JSON.parse(String(init?.body)), { text: "Hello", model_id: "test-model" });
    return new Response(new Uint8Array([1, 2, 3]), { headers: { "Content-Type": "audio/mpeg" } });
  } });
  const speech = await provider.generateSpeech({ voiceId: "voice-a", text: "Hello" });
  assert.equal(speech.bytes.byteLength, 3);
  assert.equal(speech.provider, "elevenlabs");
  assert.equal("duration" in speech, false);
});

test("provider errors never expose upstream bodies or the key", async () => {
  const provider = new ElevenLabsProvider({ apiKey: "test-placeholder", fetcher: async () => new Response("private input test-placeholder", { status: 401 }) });
  try { await provider.listVoices(); assert.fail("Expected rejection"); }
  catch (error) {
    const response = errorResponse(error);
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.doesNotMatch(body, /test-placeholder|private input/);
  }
});

test("paid voice rejection gives actionable feedback without exposing provider details", async () => {
  const provider = new ElevenLabsProvider({ apiKey: "test-placeholder", fetcher: async () => new Response("private account details", { status: 402 }) });
  try { await provider.generateSpeech({ voiceId: "a", text: "Hello" }); assert.fail("Expected rejection"); }
  catch (error) {
    const response = errorResponse(error);
    assert.equal(response.status, 402);
    const body = await response.text();
    assert.match(body, /built-in voice/);
    assert.doesNotMatch(body, /private account details/);
  }
});

test("empty or non-audio responses cannot become assets", async () => {
  for (const response of [new Response(null, { headers: { "Content-Type": "audio/mpeg" } }), new Response("bad", { headers: { "Content-Type": "text/html" } })]) {
    const provider = new ElevenLabsProvider({ apiKey: "test-placeholder", fetcher: async () => response });
    await assert.rejects(provider.generateSpeech({ voiceId: "a", text: "Hello" }), /invalid audio/);
  }
});

test("local generation rejects missing origins, cross-site requests, and remote hosts", () => {
  assert.doesNotThrow(() => assertLocalRequest(new Request("http://localhost:3000/api/speech", { headers: { origin: "http://localhost:3000" } }), true));
  assert.doesNotThrow(() => assertLocalRequest(new Request("http://localhost:3000/api/speech", { headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" } }), true));
  for (const request of [new Request("http://localhost:3000/api/speech"), new Request("http://localhost:3000/api/speech", { headers: { origin: "https://attacker.invalid" } }), new Request("http://example.com/api/speech", { headers: { origin: "http://example.com" } })]) {
    assert.throws(() => assertLocalRequest(request, true));
  }
});

test("speech input rejects malformed JSON, path injection, blanks, and oversized bodies", async () => {
  const request = (body: string) => new Request("http://localhost:3000/api/speech", { method: "POST", headers: { "Content-Type": "application/json" }, body });
  for (const body of ["{", "null", JSON.stringify({ voiceId: "../../a", text: "Hello" }), JSON.stringify({ voiceId: "a", text: " " }), JSON.stringify({ voiceId: "a", text: "a".repeat(1001) }), "a".repeat(8193)]) {
    await assert.rejects(readSpeechInput(request(body)));
  }
  assert.deepEqual(await readSpeechInput(request(JSON.stringify({ voiceId: "a", text: " Hello " }))), { voiceId: "a", text: "Hello" });
});

test("duration retains exact decoded values and rejects invalid values", () => {
  assert.equal(validateDuration(1.234567), 1.234567);
  for (const duration of [NaN, Infinity, -1, 0, 601]) assert.throws(() => validateDuration(duration));
});
