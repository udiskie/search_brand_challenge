import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import type { PriorityItem } from "@/aeo/types";

const IMPACT_STYLES: Record<string, string> = {
  high: "text-red-700 dark:text-red-400",
  medium: "text-amber-700 dark:text-amber-400",
  low: "text-muted-foreground",
};

export function PriorityMatrixTable({ priorities }: { priorities: PriorityItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="py-2 pr-4 font-medium">Dim</th>
            <th className="py-2 pr-4 font-medium">Finding</th>
            <th className="py-2 pr-4 font-medium">
              Impact
              <InfoTooltip>
                How much fixing this finding would move the score: high, medium, or low.
              </InfoTooltip>
            </th>
            <th className="py-2 pr-4 font-medium">
              Effort
              <InfoTooltip>Rough cost to address this finding: high, medium, or low.</InfoTooltip>
            </th>
            <th className="py-2 font-medium">Suggested action</th>
          </tr>
        </thead>
        <tbody>
          {priorities.map((p, i) => (
            <tr key={i} className="border-b border-border/60 align-top last:border-0">
              <td className="py-2 pr-4 text-xs font-medium text-muted-foreground uppercase">
                {p.dimension}
              </td>
              <td className="py-2 pr-4">{p.finding}</td>
              <td className={`py-2 pr-4 font-medium ${IMPACT_STYLES[p.impact]}`}>{p.impact}</td>
              <td className="py-2 pr-4 text-muted-foreground">{p.effort}</td>
              <td className="py-2 text-muted-foreground">{p.suggestedAction}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
