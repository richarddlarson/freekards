/**
 * Difficulty model (spec 08-characters.md).
 *
 * effective skill = clamp(baseline + character adjustment, 0.05, 0.98)
 */

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTY_BASELINE: Readonly<Record<Difficulty, number>> = {
  easy: 0.3,
  medium: 0.55,
  hard: 0.8,
};

export const SKILL_ADJUSTMENT_MIN = -0.15;
export const SKILL_ADJUSTMENT_MAX = 0.15;
export const SKILL_MIN = 0.05;
export const SKILL_MAX = 0.98;

export function effectiveSkill(difficulty: Difficulty, adjustment: number): number {
  const adj = Math.min(SKILL_ADJUSTMENT_MAX, Math.max(SKILL_ADJUSTMENT_MIN, adjustment));
  return Math.min(SKILL_MAX, Math.max(SKILL_MIN, DIFFICULTY_BASELINE[difficulty] + adj));
}

/** What a computer player needs to know about itself to make decisions. */
export interface AiProfile {
  /** Effective skill, 0.05–0.98. */
  skill: number;
  /** Willingness to take risks (e.g. attempt to shoot the moon), 0–1. */
  risk: number;
}
