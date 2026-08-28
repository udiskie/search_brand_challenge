import Link from "next/link";
import { AeoEmphasisBarChart, AeoShareOfVoiceChart } from "@/components/dashboard/AeoShareOfVoiceChart";
import { DocsPromptDialog } from "@/components/dashboard/DocsPromptDialog";
import { MethodologyLink } from "@/components/dashboard/MethodologyLink";
import { Panel } from "@/components/dashboard/Panel";
import { PriorityMatrixTable } from "@/components/dashboard/PriorityMatrixTable";
import { ScoreBadge } from "@/components/dashboard/ScoreBadge";
import { SiteHeader } from "@/components/dashboard/SiteHeader";
import { Button } from "@/components/ui/button";
import { listProductSummaries } from "@/lib/dashboardData";

/** The product this dashboard is built to audit -- see WORK_PLAN.md/DECISIONS.md. */
const MY_PRODUCT = "linear";

export default async function Home() {
  const summaries = await listProductSummaries();
  const myReport = summaries.find((s) => s.product === MY_PRODUCT)?.report;
  const competitorSummaries = summaries.filter((s) => s.product !== MY_PRODUCT);

  const topPriorities = myReport?.priorities.filter((p) => p.impact === "high" || p.impact === "medium") ?? [];

  const crossAuditData = myReport
    ? summaries
        .map((s) => s.report)
        .filter((report): report is NonNullable<typeof report> => report !== undefined)
        .map((report) => {
          const generic = report.aeo.byDimension.find(
            (d) => d.dimension === "specificity" && d.value === "generic" && d.brand === myReport.brand
          );
          return {
            label: report.brand,
            value: generic?.shareOfVoice ?? 0,
            highlighted: report.brand === myReport.brand,
          };
        })
    : [];

  return (
    <div className="flex flex-1 flex-col">
      <DocsPromptDialog />
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{myReport?.brand ?? "Linear"}</h1>
          {myReport ? (
            <Button size="sm" nativeButton={false} render={<Link href={`/products/${MY_PRODUCT}`} />}>
              See full audit
            </Button>
          ) : null}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          SEO / GEO / AEO audit results scanned into the data lake.
        </p>

        {myReport ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {myReport.scores.map((s) => (
              <ScoreBadge key={s.dimension} dimension={s.dimension} score={s.score} label={s.label} />
            ))}
          </div>
        ) : null}

        {myReport ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Panel title={`AEO — ${myReport.brand} vs. competitors`}>
              <p className="mb-3 text-xs text-muted-foreground">
                Share of Voice: the fraction of neutral Gemini answers that mention each
                brand at all, out of {myReport.aeo.totalRuns} runs.
              </p>
              <AeoShareOfVoiceChart perBrand={myReport.aeo.perBrand} myBrand={myReport.brand} />
            </Panel>

            {myReport.brandGrounded && myReport.brandGrounded.totalRuns > 0 ? (
              <Panel title={`AEO (brand-grounded, not neutral) — ${myReport.brand} vs. competitors`}>
                <p className="mb-3 text-xs text-muted-foreground">
                  Same Share of Voice metric, but over {myReport.brandGrounded.totalRuns}{" "}
                  runs of questions grounded in {myReport.brand}&apos;s own site content
                  — a best-case signal, not a fair category comparison. Don&apos;t compare
                  these numbers directly to the neutral chart.
                </p>
                <AeoShareOfVoiceChart
                  perBrand={myReport.brandGrounded.perBrand}
                  myBrand={myReport.brand}
                />
              </Panel>
            ) : null}
          </div>
        ) : null}

        {myReport && crossAuditData.length > 0 ? (
          <Panel title={`AEO — ${myReport.brand} across every product's own audit`} className="mt-4">
            <p className="mb-3 text-xs text-muted-foreground">
              {myReport.brand}&apos;s Share of Voice over generic prompts only (no brand
              named in the question), as measured by each product&apos;s own separately-run
              audit — {myReport.brand}&apos;s own run vs. how each competitor&apos;s audit
              independently rates {myReport.brand}. Restricted to the brand-agnostic prompt
              subset so no audit&apos;s self-naming prompts (e.g. &quot;Alternatives to{" "}
              {myReport.brand}...&quot;) bias the comparison.
            </p>
            <AeoEmphasisBarChart
              data={crossAuditData}
              legend={{ highlighted: `${myReport.brand}'s own audit`, rest: "Competitors' audits" }}
            />
          </Panel>
        ) : null}

        {myReport && topPriorities.length > 0 ? (
          <Panel
            title="Priority matrix (impact × effort) — high & medium impact"
            action={<MethodologyLink anchor="priority-matrix" />}
            className="mt-4"
          >
            <PriorityMatrixTable priorities={topPriorities} />
          </Panel>
        ) : null}

        {competitorSummaries.length === 0 ? (
          <Panel className="mt-8">
            <p className="text-sm text-muted-foreground">
              No products found in <code>datalake/</code> yet. Run{" "}
              <code>npm run scrape</code> to get started.
            </p>
          </Panel>
        ) : (
          <>
            <h2 className="mt-8 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Competitors
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {competitorSummaries.map(({ product, report }) => (
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
          </>
        )}
      </main>
    </div>
  );
}
