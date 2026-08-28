import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InfoTooltip } from "@/components/dashboard/InfoTooltip";
import { MethodologyLink } from "@/components/dashboard/MethodologyLink";
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

function AeoTableHeaderRow() {
  return (
    <tr className="border-b border-border text-left text-xs text-muted-foreground">
      <th className="py-2 pr-4 font-medium">Brand</th>
      <th className="py-2 pr-4 font-medium">
        Share of Voice
        <InfoTooltip>
          Fraction of AI answers that mention this brand at all (0–100%), computed
          independently per brand. Answers can mention several brands or none, so values
          across brands don&apos;t need to add up to 100%.
        </InfoTooltip>
      </th>
      <th className="py-2 pr-4 font-medium">
        Relative SoV
        <InfoTooltip>
          This brand&apos;s Share of Voice divided by the competitors&apos; average. 1.0x
          means on par with the average competitor; above 1.0x is ahead, below is behind.
        </InfoTooltip>
      </th>
      <th className="py-2 pr-4 font-medium">
        Avg Position
        <InfoTooltip>
          Average position within an answer&apos;s brand mentions (1 = mentioned first),
          averaged across answers that mention this brand. Shown as — when the brand is
          never mentioned.
        </InfoTooltip>
      </th>
      <th className="py-2 pr-4 font-medium">
        First-Mention
        <InfoTooltip>
          Fraction of answers (0–100%) where this brand is the very first one mentioned.
        </InfoTooltip>
      </th>
      <th className="py-2 font-medium">
        Sentiment
        <InfoTooltip>
          Average tone of this brand&apos;s mentions, from -1 (negative) to +1 (positive);
          0 is neutral.
        </InfoTooltip>
      </th>
    </tr>
  );
}

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
            <Panel title="Executive summary" action={<MethodologyLink anchor="scores" />}>
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

            <Panel title="AEO — Share of Voice" action={<MethodologyLink anchor="aeo" />}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <AeoTableHeaderRow />
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
              <Panel
                title="Brand-grounded question performance (not neutral)"
                action={<MethodologyLink anchor="brand-grounded" />}
              >
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
                      <AeoTableHeaderRow />
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
              <Panel title="SEO" action={<MethodologyLink anchor="seo" />}>
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

              <Panel title="GEO" action={<MethodologyLink anchor="geo" />}>
                <div className="mb-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    E-E-A-T is partially proxied, not directly measured — see{" "}
                    <Link href="/methodology#geo" className="underline hover:no-underline">
                      which parts
                    </Link>
                    .
                  </span>
                </div>
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
              <Panel
                title="Word occurrences (scraped content)"
                action={<MethodologyLink anchor="word-occurrences" />}
              >
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

            <Panel
              title="Priority matrix (impact × effort)"
              action={<MethodologyLink anchor="priority-matrix" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-4 font-medium">Dim</th>
                      <th className="py-2 pr-4 font-medium">Finding</th>
                      <th className="py-2 pr-4 font-medium">
                        Impact
                        <InfoTooltip>
                          How much fixing this finding would move the score: high, medium,
                          or low.
                        </InfoTooltip>
                      </th>
                      <th className="py-2 pr-4 font-medium">
                        Effort
                        <InfoTooltip>
                          Rough cost to address this finding: high, medium, or low.
                        </InfoTooltip>
                      </th>
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
