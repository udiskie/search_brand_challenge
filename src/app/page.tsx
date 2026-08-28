import Link from "next/link";
import { DocsPromptDialog } from "@/components/dashboard/DocsPromptDialog";
import { Panel } from "@/components/dashboard/Panel";
import { ScoreBadge } from "@/components/dashboard/ScoreBadge";
import { SiteHeader } from "@/components/dashboard/SiteHeader";
import { listProductSummaries } from "@/lib/dashboardData";

export default async function Home() {
  const summaries = await listProductSummaries();

  return (
    <div className="flex flex-1 flex-col">
      <DocsPromptDialog />
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          SEO / GEO / AEO audit results scanned into the data lake.
        </p>

        {summaries.length === 0 ? (
          <Panel className="mt-8">
            <p className="text-sm text-muted-foreground">
              No products found in <code>datalake/</code> yet. Run{" "}
              <code>npm run scrape</code> to get started.
            </p>
          </Panel>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {summaries.map(({ product, report }) => (
              <Link key={product} href={`/products/${product}`} className="block">
                <Panel className="h-full transition-colors hover:border-foreground/40">
                  <h2 className="text-base font-semibold capitalize">
                    {report?.brand ?? product}
                  </h2>
                  {report ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {report.scores.map((s) => (
                        <ScoreBadge
                          key={s.dimension}
                          dimension={s.dimension}
                          score={s.score}
                          label={s.label}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">
                      Scraped — no AEO report yet
                    </p>
                  )}
                </Panel>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
