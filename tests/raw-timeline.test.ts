import assert from "node:assert/strict";
import { test } from "node:test";
import { buildRawTimeline } from "../lib/audio/raw-timeline.ts";
import type { AudioAsset } from "../types/audio.ts";

function asset(id: string, duration: number): AudioAsset {
  return { id, duration, url: "blob:test", provider: "fixture", model: "fixture", metadata: { voiceId: "a", text: "Hi", createdAt: "test" } };
}
const turns = [{ id: "a", characterId: "maya", text: "Hello", generatedAssetId: "first" }, { id: "b", characterId: "david", text: "Hi", generatedAssetId: "second" }];

test("raw positions are the exact sum of measured durations with zero added gaps", () => {
  const clips = buildRawTimeline(turns, { first: asset("first", 1.234567), second: asset("second", 2.345678) });
  assert.equal(clips[0].startTime, 0);
  assert.equal(clips[1].startTime, 1.234567);
  assert.equal(clips[1].duration, 2.345678);
  assert.deepEqual(buildRawTimeline(turns, { first: asset("first", 1.234567), second: asset("second", 2.345678) }), clips);
});

test("incomplete scenes and duplicate turn ids cannot form a playable timeline", () => {
  assert.throws(() => buildRawTimeline(turns, { first: asset("first", 1) }), /Every turn/);
  assert.throws(() => buildRawTimeline([turns[0], turns[0]], { first: asset("first", 1) }), /unique/);
  assert.throws(() => buildRawTimeline([], {}), /1–10/);
});

test("invalid asset durations and mismatched asset ids fail closed", () => {
  for (const duration of [0, NaN, Infinity, -1, 601]) assert.throws(() => buildRawTimeline([turns[0]], { first: asset("first", duration) }));
  assert.throws(() => buildRawTimeline([turns[0]], { first: asset("wrong-id", 1) }));
});
