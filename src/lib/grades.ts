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

export const GRADE_COLORS: Record<Grade, string> = {
  BiS: "bg-[#ffd54a] text-black",
  "S+": "bg-[#7dff4d] text-black",
  S: "bg-[#21d96b] text-black",
  A: "bg-[#ff9a2e] text-black",
  B: "bg-[#ff6a3d] text-white",
  C: "bg-[#ff3b3b] text-white",
  D: "bg-[#b81f2d] text-white",
  "?": "bg-[#7a8594] text-white",
};

/** Rank colours as CSS hex (aura / card glow palette). */
export const GRADE_HEX_CSS: Record<Grade, string> = {
  BiS: "#ffd54a", "S+": "#7dff4d", S: "#21d96b", A: "#ff9a2e", B: "#ff6a3d", C: "#ff3b3b", D: "#b81f2d", "?": "#7a8594",
};
/** Glow strength per rank (BiS strongest). */
export const GRADE_GLOW: Record<Grade, number> = { BiS: 1, "S+": 0.9, S: 0.75, A: 0.6, B: 0.45, C: 0.35, D: 0.25, "?": 0.2 };
