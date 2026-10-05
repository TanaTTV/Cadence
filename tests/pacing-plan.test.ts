import assert from "node:assert/strict";
import { test } from "node:test";
import { validatePacingPlan } from "../lib/pacing/validate-plan.ts";
import type { TimelineClip } from "../types/project.ts";

const clips: TimelineClip[] = [
  { id: "a", assetId: "asset-a", dialogueTurnId: "a", startTime: 0, duration: 2.5, gain: 1 },
  { id: "b", assetId: "asset-b", dialogueTurnId: "b", startTime: 2.5, duration: 1.2, gain: 1 },
];
const first = { clipId: "a", relationship: "after_previous", gapSeconds: 0 };
function plan(second: unknown) { return { version: 1, instructions: [first, second] }; }

test("validated plans canonicalize order, copy input, and preserve semantic delays", () => {
  const input = { version: 1, instructions: [{ clipId: "b", relationship: "reaction_delay", gapSeconds: 1.2, reason: "Processing the news" }, first] };
  const result = validatePacingPlan(input, clips);
  assert.deepEqual(result.instructions.map((i) => i.clipId), ["a", "b"]);
  assert.equal(result.instructions[1].gapSeconds, 1.2);
  assert.notEqual(result.instructions[0], first);
  assert.equal(input.instructions[0].clipId, "b");
});

test("all semantic timing relationships validate without calculating timestamps", () => {
  for (const relationship of ["after_previous", "immediate_response", "reaction_delay", "hesitation", "beat", "dramatic_pause"]) {
    assert.equal(validatePacingPlan(plan({ clipId: "b", relationship, gapSeconds: 0.2 }), clips).instructions[1].relationship, relationship);
  }
  for (const relationship of ["overlap_previous", "interrupt_previous"]) {
    assert.equal(validatePacingPlan(plan({ clipId: "b", relationship, overlapSeconds: 0.35 }), clips).instructions[1].overlapSeconds, 0.35);
  }
});

test("model timestamps, unknown fields, and malformed output are rejected", () => {
  for (const value of [null, [], {}, { ...plan({ clipId: "b", relationship: "beat", gapSeconds: 1 }), startTime: 9 }, plan({ clipId: "b", relationship: "beat", gapSeconds: 1, startTime: 7 }), plan({ clipId: "b", relationship: "random", gapSeconds: 1 })]) {
    assert.throws(() => validatePacingPlan(value, clips));
  }
});

test("missing, unknown, and duplicate clip instructions fail atomically", () => {
  for (const instructions of [[first], [first, first], [first, { clipId: "unknown", relationship: "beat", gapSeconds: 1 }]]) {
    assert.throws(() => validatePacingPlan({ version: 1, instructions }, clips));
  }
});

test("gaps reject NaN, infinity, negatives, excessive pauses, and mixed overlap", () => {
  for (const gapSeconds of [NaN, Infinity, -0.1, 10.01, "1"]) assert.throws(() => validatePacingPlan(plan({ clipId: "b", relationship: "beat", gapSeconds }), clips));
  assert.throws(() => validatePacingPlan(plan({ clipId: "b", relationship: "immediate_response", gapSeconds: 0.3 }), clips));
  assert.throws(() => validatePacingPlan(plan({ clipId: "b", relationship: "beat", gapSeconds: 1, overlapSeconds: 0.1 }), clips));
});

test("overlap cannot precede the previous clip's start or apply to the first clip", () => {
  for (const overlapSeconds of [0, -0.1, 2.51, NaN, Infinity]) assert.throws(() => validatePacingPlan(plan({ clipId: "b", relationship: "overlap_previous", overlapSeconds }), clips));
  assert.throws(() => validatePacingPlan({ version: 1, instructions: [{ clipId: "a", relationship: "overlap_previous", overlapSeconds: 0.1 }, { clipId: "b", relationship: "beat", gapSeconds: 0 }] }, clips));
  assert.throws(() => validatePacingPlan({ version: 1, instructions: [{ ...first, gapSeconds: 1 }, { clipId: "b", relationship: "beat", gapSeconds: 0 }] }, clips));
});
