import type { Grade } from "@/lib/types";
import { GRADE_COLORS } from "@/lib/grades";

export function GradeBadge({ grade, score, size = "md" }: { grade: Grade; score?: number; size?: "sm" | "md" | "lg" }) {
  const cls = size === "lg" ? "text-lg px-3 py-1" : size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-0.5";
  return (
    <span className={`inline-flex items-center gap-1 rounded-md font-bold ${GRADE_COLORS[grade]} ${cls}`}>
      {grade}
      {score !== undefined && <span className="font-normal opacity-80">{score}</span>}
    </span>
  );
}
