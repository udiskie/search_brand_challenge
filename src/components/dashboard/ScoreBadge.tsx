import { cn } from "@/lib/utils";
import type { ScoreLabel } from "@/aeo/types";

const LABEL_STYLES: Record<ScoreLabel, string> = {
  good: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  needs_work: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  critical: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const LABEL_TEXT: Record<ScoreLabel, string> = {
  good: "Good",
  needs_work: "Needs work",
  critical: "Critical",
};

export function ScoreBadge({
  dimension,
  score,
  label,
  className,
}: {
  dimension: string;
  score: number;
  label: ScoreLabel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        LABEL_STYLES[label],
        className
      )}
    >
      {dimension.toUpperCase()} {score}/100 · {LABEL_TEXT[label]}
    </span>
  );
}
