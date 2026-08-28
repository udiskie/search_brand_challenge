import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Simple bordered container using the existing card theme tokens -- kept as plain Tailwind rather than pulling in shadcn's Card primitive, since this dashboard has no need for its composable sub-parts. */
export function Panel({
  title,
  action,
  id,
  children,
  className,
}: {
  title?: string;
  /** Optional control rendered top-right of the title, e.g. a methodology link. */
  action?: ReactNode;
  /** Optional anchor id, e.g. for deep-linking from the methodology page. */
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("scroll-mt-6 rounded-lg border border-border bg-card p-5 text-card-foreground", className)}
    >
      {title || action ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}
