import { pacingRelationships } from "../../types/pacing.ts";
import type { PacingInstruction, PacingPlan, PacingRelationship } from "../../types/pacing.ts";
import type { TimelineClip } from "../../types/project.ts";
import { validateDuration } from "../audio/browser-audio.ts";

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a pacing object.");
  return value as Record<string, unknown>;
}

function onlyKeys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new Error("Pacing plans cannot specify timestamps or unknown fields.");
}

/** Validate the whole plan before returning anything that could be applied to a project. */
export function validatePacingPlan(value: unknown, clips: TimelineClip[]): PacingPlan {
  if (!clips.length || clips.length > 10 || new Set(clips.map((c) => c.id)).size !== clips.length)
    throw new Error("Pacing requires 1–10 unique clips.");
  for (const clip of clips) validateDuration(clip.duration);
  const plan = object(value);
  onlyKeys(plan, ["version", "instructions"]);
  if (plan.version !== 1 || !Array.isArray(plan.instructions) || plan.instructions.length !== clips.length)
    throw new Error("Pacing plan must contain exactly one instruction per clip, with version 1.");
  const instructions = new Map<string, PacingInstruction>();
  for (const entry of plan.instructions) {
    const item = object(entry);
    onlyKeys(item, ["clipId", "relationship", "gapSeconds", "overlapSeconds", "reason"]);
    if (typeof item.clipId !== "string" || !clips.some((c) => c.id === item.clipId) || instructions.has(item.clipId))
      throw new Error("Pacing plan contains an unknown or repeated clip id.");
    if (typeof item.relationship !== "string" || !pacingRelationships.includes(item.relationship as PacingRelationship))
      throw new Error("Unknown timing relationship.");
    if (item.reason !== undefined && (typeof item.reason !== "string" || item.reason.length > 500))
      throw new Error("Pacing reasons must be strings of at most 500 characters.");
    const relationship = item.relationship as PacingRelationship;
    const index = clips.findIndex((c) => c.id === item.clipId);
    const overlap = relationship === "overlap_previous" || relationship === "interrupt_previous";
    let instruction: PacingInstruction;
    if (overlap) {
      if (index === 0 || item.gapSeconds !== undefined || typeof item.overlapSeconds !== "number"
        || !Number.isFinite(item.overlapSeconds) || item.overlapSeconds <= 0 || item.overlapSeconds > Math.min(10, clips[index - 1].duration))
        throw new Error("Overlap must be positive, within the previous clip's duration, and cannot include a gap.");
      instruction = { clipId: item.clipId, relationship, overlapSeconds: item.overlapSeconds };
    } else {
      const limit = relationship === "immediate_response" ? 0.25 : 10;
      if (item.overlapSeconds !== undefined || typeof item.gapSeconds !== "number" || !Number.isFinite(item.gapSeconds)
        || item.gapSeconds < 0 || item.gapSeconds > limit)
        throw new Error("Gap must be finite, nonnegative, within the relationship's limit, and cannot include overlap.");
      if (index === 0 && (relationship !== "after_previous" || item.gapSeconds !== 0))
        throw new Error("The first clip must use after_previous with a zero gap.");
      instruction = { clipId: item.clipId, relationship, gapSeconds: item.gapSeconds };
    }
    if (typeof item.reason === "string") instruction.reason = item.reason;
    instructions.set(item.clipId, instruction);
  }
  // Canonical dialogue order, irrespective of the model's output ordering.
  return { version: 1, instructions: clips.map((clip) => instructions.get(clip.id)!) };
}
