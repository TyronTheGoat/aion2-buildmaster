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
