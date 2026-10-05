export const pacingRelationships = ["after_previous", "immediate_response", "reaction_delay", "hesitation", "beat", "dramatic_pause", "overlap_previous", "interrupt_previous"] as const;
export type PacingRelationship = typeof pacingRelationships[number];
export interface PacingInstruction {
  clipId: string;
  relationship: PacingRelationship;
  gapSeconds?: number;
  overlapSeconds?: number;
  reason?: string;
}
export interface PacingPlan { version: 1; instructions: PacingInstruction[] }
