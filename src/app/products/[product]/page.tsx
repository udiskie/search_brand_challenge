import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/dashboard/Panel";
import { ScoreBadge } from "@/components/dashboard/ScoreBadge";
import { SiteHeader } from "@/components/dashboard/SiteHeader";
import { TagcloudBarChart } from "@/components/dashboard/TagcloudBarChart";
import {
  getCandidateQuestions,
  getReport,
  getTagcloud,
  listProducts,
} from "@/lib/dashboardData";

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(0)}%`;
}

const IMPACT_STYLES: Record<string, string> = {
  high: "text-red-700 dark:text-red-400",
  medium: "text-amber-700 dark:text-amber-400",
  low: "text-muted-foreground",
};

export default async function ProductPage(props: PageProps<"/products/[product]">) {
  const { product } = await props.params;

  const knownProducts = await listProducts();
  if (!knownProducts.includes(product)) notFound();

  const [report, tagcloud, candidateQuestions] = await Promise.all([
    getReport(product),
    getTagcloud(product),
    getCandidateQuestions(product),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link href="/" className="text-sm text-link hover:underline">
            ← All products
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight capitalize">
            {report?.brand ?? product}
          </h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {candidateQuestions ? (
              <Link
                href={`/products/${product}/questions`}
                className="inline-block text-sm text-link hover:underline"
              >
                View {candidateQuestions.hookQuestions.length +
                  candidateQuestions.inferentialQuestions.length}{" "}
                candidate questions →
              </Link>
            ) : null}
            {tagcloud ? (
              <Link
                href={`/products/${product}/clusters`}
                className="inline-block text-sm text-link hover:underline"
              >
                View term clusters →
              </Link>
            ) : null}
          </div>
        </div>

        {!report ? (
          <Panel>
            <p className="text-sm text-muted-foreground">
              This product has been scraped but has no AEO report yet. Generate one with:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {`npm run aeo -- --product ${product} --brand <Brand> --competitors <A,B,C> --category "<category>"`}
            </pre>
          </Panel>
        ) : (
          <>
            <Panel title="Executive summary">
              <div className="flex flex-wrap gap-2">
                {report.scores.map((s) => (
                  <ScoreBadge key={s.dimension} dimension={s.dimension} score={s.score} label={s.label} />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Generated {new Date(report.generatedAt).toLocaleString()} · Competitors:{" "}
                {report.competitors.join(", ")}
              </p>
            </Panel>

            <Panel title="AEO — Share of Voice">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Brand</th>
                      <th className="py-2 pr-4 font-medium">Share of Voice</th>
                      <th className="py-2 pr-4 font-medium">Relative SoV</th>
                      <th className="py-2 pr-4 font-medium">Avg Position</th>
                      <th className="py-2 pr-4 font-medium">First-Mention</th>
                      <th className="py-2 font-medium">Sentiment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.aeo.perBrand.map((b) => (
                      <tr key={b.brand} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-4 font-medium">{b.brand}</td>
                        <td className="py-2 pr-4">{fmtPct(b.shareOfVoice)}</td>
                        <td className="py-2 pr-4">{b.relativeShareOfVoice.toFixed(2)}x</td>
                        <td className="py-2 pr-4">{b.averagePosition?.toFixed(1) ?? "—"}</td>
                        <td className="py-2 pr-4">{fmtPct(b.firstMentionRate)}</td>
                        <td className="py-2">{b.sentimentScore.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {report.aeo.totalRuns} neutral prompt runs ·{" "}
                <Link href={`/products/${product}/prompts`} className="text-link underline hover:no-underline">
                  See prompts sent →
                </Link>
              </p>
            </Panel>

            {report.brandGrounded && report.brandGrounded.totalRuns > 0 ? (
              <Panel title="Brand-grounded question performance (not neutral)">
                <p className="text-xs text-muted-foreground">
                  Results from running brand-grounded candidate questions through Gemini —
                  do not compare directly to the neutral AEO table above; see{" "}
                  <Link
                    href={`/products/${product}/questions`}
                    className="text-link underline hover:no-underline"
                  >
                    the candidate questions
                  </Link>{" "}
                  for context, or{" "}
                  <Link
                    href={`/products/${product}/prompts`}
                    className="text-link underline hover:no-underline"
                  >
                    the prompts sent →
                  </Link>
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Brand</th>
                        <th className="py-2 pr-4 font-medium">Share of Voice</th>
                        <th className="py-2 pr-4 font-medium">Relative SoV</th>
                        <th className="py-2 pr-4 font-medium">Avg Position</th>
                        <th className="py-2 pr-4 font-medium">First-Mention</th>
                        <th className="py-2 font-medium">Sentiment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.brandGrounded.perBrand.map((b) => (
                        <tr key={b.brand} className="border-b border-border/60 last:border-0">
                          <td className="py-2 pr-4 font-medium">{b.brand}</td>
                          <td className="py-2 pr-4">{fmtPct(b.shareOfVoice)}</td>
                          <td className="py-2 pr-4">{b.relativeShareOfVoice.toFixed(2)}x</td>
                          <td className="py-2 pr-4">{b.averagePosition?.toFixed(1) ?? "—"}</td>
                          <td className="py-2 pr-4">{fmtPct(b.firstMentionRate)}</td>
                          <td className="py-2">{b.sentimentScore.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Panel>
            ) : null}

            <div className="grid gap-6 sm:grid-cols-2">
              <Panel title="SEO">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Pages analyzed</dt>
                    <dd>{report.seo.pageCount}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Broken sitemap URLs</dt>
                    <dd>{report.seo.brokenUrlCount}</dd>
                  </div>
                </dl>
                {tagcloud ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {tagcloud.site.slice(0, 15).map((t) => (
                      <span
                        key={t.term}
                        className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      >
                        {t.term}
                      </span>
                    ))}
                  </div>
                ) : null}
              </Panel>

              <Panel title="GEO">
                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Avg factual density</dt>
                    <dd>{report.geo.avgFactualDensityScore.toFixed(2)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Avg extractable structure</dt>
                    <dd>{report.geo.avgExtractableStructureScore.toFixed(2)}</dd>
                  </div>
                </dl>
                {report.crossValidationGaps.filter((g) => !g.mentionedByModel).length > 0 ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {report.crossValidationGaps.filter((g) => !g.mentionedByModel).length} of the
                    site&apos;s top {report.crossValidationGaps.length} keywords never show up in
                    how the model describes {report.brand}.
                  </p>
                ) : null}
              </Panel>
            </div>

            {tagcloud && tagcloud.site.length > 0 ? (
              <Panel title="Word occurrences (scraped content)">
                <p className="mb-3 text-xs text-muted-foreground">
                  Raw count of how many times each of the top {Math.min(20, tagcloud.site.length)}{" "}
                  terms appears across the crawled pages — not the tf-idf ranking used elsewhere,
                  just occurrences.
                </p>
                <TagcloudBarChart
                  terms={[...tagcloud.site]
                    .sort((a, b) => b.occurrences - a.occurrences)
                    .slice(0, 20)}
                />
              </Panel>
            ) : null}

            <Panel title="Priority matrix (impact × effort)">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Dim</th>
                      <th className="py-2 pr-4 font-medium">Finding</th>
                      <th className="py-2 pr-4 font-medium">Impact</th>
                      <th className="py-2 pr-4 font-medium">Effort</th>
                      <th className="py-2 font-medium">Suggested action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.priorities.map((p, i) => (
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
            </Panel>
          </>
        )}
      </main>
    </div>
  );
}
