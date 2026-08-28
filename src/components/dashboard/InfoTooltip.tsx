import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** An (i) icon that reveals clarification (ranges, caveats) for a table header on hover/focus. */
export function InfoTooltip({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger
        className="ml-1 inline-flex align-middle text-muted-foreground hover:text-foreground"
        aria-label="More info"
      >
        <InfoIcon className="size-3" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-left">{children}</TooltipContent>
    </Tooltip>
  );
}
