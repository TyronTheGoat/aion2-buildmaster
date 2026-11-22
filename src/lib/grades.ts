import type { Grade } from "./types";

/** kisk.app grade thresholds (score in % of best piece). Source: kisk.app/scoring */
export const GRADE_THRESHOLDS: { grade: Grade; min: number }[] = [
  { grade: "BiS", min: 90 },
  { grade: "S+", min: 55 },
  { grade: "S", min: 35 },
  { grade: "A", min: 22 },
  { grade: "B", min: 12 },
  { grade: "C", min: 5 },
  { grade: "D", min: 0 },
];

export const GRADE_ORDER: Grade[] = ["?", "D", "C", "B", "A", "S", "S+", "BiS"];

export function gradeFromScore(score: number | undefined): Grade {
  if (score === undefined || Number.isNaN(score)) return "?";
  return GRADE_THRESHOLDS.find((t) => score >= t.min)?.grade ?? "D";
}

export function minScoreFor(grade: Grade): number {
  return GRADE_THRESHOLDS.find((t) => t.grade === grade)?.min ?? 0;
}

export function gradeRank(g: Grade): number {
  return GRADE_ORDER.indexOf(g);
}

/**
 * Central rank style: colour and light behaviour per rank, used everywhere (cards, badges, slot dots,
 * comparison). Change a rank here and every view follows.
 * - BiS: legendary orange-gold, strongest light, soft pulse and sparkle
 * - S+ / S: gold-yellow, S+ brighter with a light sheen, S calmer
 * - A / B: blue, A with a calm glow, B weaker and static
 * - C: greenish, weak, static
 * - D: strong red, warning glow with a slight flicker
 */
export type RankAnimation = "legendary" | "pulse" | "glow" | "static" | "flicker" | "none";
export interface RankStyle {
  /** main colour (frame, badge, text accent) */
  borderColor: string;
  /** colour of the outer glow and the light underneath */
  glowColor: string;
  /** strength of the glow and the light underneath, 0..1 */
  backgroundGlow: number;
  /** badge background and text */
  badgeColor: string;
  badgeText: string;
  /** how much the glow grows at the peak of a pulse, 0..1 */
  pulseStrength: number;
  /** glitter / sheen on the card face, 0..1 */
  sparkleIntensity: number;
  animationStyle: RankAnimation;
  /** pulse period in seconds */
  period: number;
}

export const RANK_STYLE: Record<Grade, RankStyle> = {
  BiS: { borderColor: "#ffa31a", glowColor: "#ff9a1f", backgroundGlow: 1, badgeColor: "#ffa31a", badgeText: "#1a0f00", pulseStrength: 1, sparkleIntensity: 1, animationStyle: "legendary", period: 2.8 },
  "S+": { borderColor: "#ffd23f", glowColor: "#ffcc33", backgroundGlow: 0.85, badgeColor: "#ffd23f", badgeText: "#1a1400", pulseStrength: 0.6, sparkleIntensity: 0.45, animationStyle: "pulse", period: 3.2 },
  S: { borderColor: "#e6c35c", glowColor: "#e0bd52", backgroundGlow: 0.65, badgeColor: "#e6c35c", badgeText: "#1a1400", pulseStrength: 0.3, sparkleIntensity: 0, animationStyle: "pulse", period: 3.8 },
  A: { borderColor: "#3d9bff", glowColor: "#3a8eff", backgroundGlow: 0.55, badgeColor: "#3d9bff", badgeText: "#001226", pulseStrength: 0.12, sparkleIntensity: 0, animationStyle: "glow", period: 4.5 },
  B: { borderColor: "#6a8fc7", glowColor: "#5b82bd", backgroundGlow: 0.35, badgeColor: "#6a8fc7", badgeText: "#050b16", pulseStrength: 0, sparkleIntensity: 0, animationStyle: "static", period: 0 },
  C: { borderColor: "#5fbf8a", glowColor: "#4fae7b", backgroundGlow: 0.25, badgeColor: "#5fbf8a", badgeText: "#04140b", pulseStrength: 0, sparkleIntensity: 0, animationStyle: "static", period: 0 },
  D: { borderColor: "#ff3344", glowColor: "#ff2236", backgroundGlow: 0.45, badgeColor: "#ff3344", badgeText: "#ffffff", pulseStrength: 0.15, sparkleIntensity: 0, animationStyle: "flicker", period: 3.6 },
  "?": { borderColor: "#7a8594", glowColor: "#6b7686", backgroundGlow: 0.15, badgeColor: "#7a8594", badgeText: "#ffffff", pulseStrength: 0, sparkleIntensity: 0, animationStyle: "none", period: 0 },
};

/** Rank colours as CSS hex, taken from RANK_STYLE. */
export const GRADE_HEX_CSS = Object.fromEntries(Object.entries(RANK_STYLE).map(([g, r]) => [g, r.borderColor])) as Record<Grade, string>;
/** Glow strength per rank, taken from RANK_STYLE. */
export const GRADE_GLOW = Object.fromEntries(Object.entries(RANK_STYLE).map(([g, r]) => [g, r.backgroundGlow])) as Record<Grade, number>;
