import type { TagcloudTerm } from "@/scraper/types";

const CHART_HEIGHT = 220;
const BAR_GAP = 4;
const LABEL_HEIGHT = 70;

/** Plain-SVG occurrences-per-term bar chart -- no charting library, consistent with the rest of the dashboard's hand-rolled Tailwind components. */
export function TagcloudBarChart({ terms }: { terms: TagcloudTerm[] }) {
  if (terms.length === 0) return null;

  const maxOccurrences = Math.max(...terms.map((t) => t.occurrences));
  const barWidth = 28;
  const width = terms.length * (barWidth + BAR_GAP);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT + LABEL_HEIGHT}`}
        width={width}
        height={CHART_HEIGHT + LABEL_HEIGHT}
        role="img"
        aria-label="Bar chart of scraped word occurrences"
        className="text-foreground"
      >
        {terms.map((term, i) => {
          const barHeight =
            maxOccurrences > 0 ? (term.occurrences / maxOccurrences) * (CHART_HEIGHT - 20) : 0;
          const x = i * (barWidth + BAR_GAP);
          const y = CHART_HEIGHT - barHeight;
          return (
            <g key={term.term}>
              <title>{`${term.term}: ${term.occurrences} occurrences`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                className="fill-primary/70 hover:fill-primary"
                rx={2}
              />
              <text
                x={x + barWidth / 2}
                y={y - 4}
                textAnchor="middle"
                className="fill-muted-foreground text-[10px]"
              >
                {term.occurrences}
              </text>
              <text
                x={x + barWidth / 2}
                y={CHART_HEIGHT + 14}
                textAnchor="end"
                transform={`rotate(-45 ${x + barWidth / 2} ${CHART_HEIGHT + 14})`}
                className="fill-muted-foreground text-[10px]"
              >
                {term.term}
              </text>
            </g>
          );
        })}
        <line
          x1={0}
          y1={CHART_HEIGHT}
          x2={width}
          y2={CHART_HEIGHT}
          className="stroke-border"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
