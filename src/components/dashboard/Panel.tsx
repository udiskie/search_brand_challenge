import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Simple bordered container using the existing card theme tokens -- kept as plain Tailwind rather than pulling in shadcn's Card primitive, since this dashboard has no need for its composable sub-parts. */
export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  /** Optional control rendered top-right of the title, e.g. a sort dropdown. */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-card p-5 text-card-foreground", className)}>
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
