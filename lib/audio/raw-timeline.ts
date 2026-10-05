import type { AudioAsset } from "../../types/audio.ts";
import type { DialogueTurn, TimelineClip } from "../../types/project.ts";
import { validateDuration } from "./browser-audio.ts";

export function buildRawTimeline(turns: DialogueTurn[], assets: Record<string, AudioAsset>): TimelineClip[] {
  if (!turns.length || turns.length > 10) throw new Error("A scene must have 1–10 dialogue turns.");
  const seen = new Set<string>();
  let startTime = 0;
  return turns.map((turn) => {
    if (seen.has(turn.id)) throw new Error("Dialogue turn ids must be unique.");
    seen.add(turn.id);
    const asset = turn.generatedAssetId ? assets[turn.generatedAssetId] : undefined;
    if (!asset || asset.id !== turn.generatedAssetId) throw new Error("Every turn needs a generated audio asset.");
    const duration = validateDuration(asset.duration);
    const clip = { id: turn.id, assetId: asset.id, dialogueTurnId: turn.id, startTime, duration, gain: 1 };
    startTime += duration;
    return clip;
  });
}
