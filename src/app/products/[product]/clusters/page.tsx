import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/dashboard/Panel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";
import { ThemeSankey } from "@/components/dashboard/ThemeSankey";
import { ThemeTreemap } from "@/components/dashboard/ThemeTreemap";
import { getThemeClusters } from "@/lib/dashboardData";
import type { ClusteringMethod } from "@/clustering/types";

const METHOD_LABELS: Record<ClusteringMethod, string> = {
  taxonomy: "Hand-curated taxonomy",
  llm: "LLM-based",
};

export default async function ClustersPage(
  props: PageProps<"/products/[product]/clusters">
) {
  const { product } = await props.params;
  const searchParams = await props.searchParams;
  const requestedMethod = searchParams.method === "llm" ? "llm" : "taxonomy";

  let clustering = await getThemeClusters(product, requestedMethod);
  let fellBackFrom: ClusteringMethod | undefined;

  if (!clustering && requestedMethod === "llm") {
    clustering = await getThemeClusters(product, "taxonomy");
    if (clustering) fellBackFrom = "llm";
  }

  if (!clustering) notFound();

  const totalQuestions = clustering.themes.reduce((sum, t) => sum + t.questions.length, 0);
  const totalMentioning = clustering.themes.reduce(
    (sum, t) => sum + t.neutralAnswers.runsMentioning + t.brandGroundedAnswers.runsMentioning,
    0
  );

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link
            href={`/products/${product}`}
            className="text-sm text-muted-foreground hover:underline"
          >
            ← Back to report
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight capitalize">
            {product} — term clusters
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tagcloud terms grouped into named themes, correlated against candidate
            questions and Gemini&apos;s raw answers. Method:{" "}
            <span className="font-medium text-foreground">
              {METHOD_LABELS[clustering.method]}
            </span>
            .
          </p>
          {fellBackFrom ? (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
              LLM-based clustering hasn&apos;t been run for this product yet -- showing
              the taxonomy method instead.
            </p>
          ) : null}
          <div className="mt-2 flex gap-3 text-xs">
            <Link
              href={`/products/${product}/clusters?method=taxonomy`}
              className={
                requestedMethod === "taxonomy"
                  ? "font-medium text-foreground underline"
                  : "text-muted-foreground hover:underline"
              }
            >
              Taxonomy
            </Link>
            <Link
              href={`/products/${product}/clusters?method=llm`}
              className={
                requestedMethod === "llm"
                  ? "font-medium text-foreground underline"
                  : "text-muted-foreground hover:underline"
              }
            >
              LLM-based
            </Link>
          </div>
        </div>

        <Panel title="Theme size (combined term score)">
          <ThemeTreemap themes={clustering.themes} />
        </Panel>

        <Panel title="Question coverage vs. answer mentions">
          <p className="mb-3 text-xs text-muted-foreground">
            {totalQuestions} candidate questions and {totalMentioning} answer-run
            mentions map into these {clustering.themes.length} themes. A theme flowing
            into &quot;Never mentioned in answers&quot; despite having candidate
            questions is a GEO gap at the theme level.
          </p>
          <ThemeSankey themes={clustering.themes} />
        </Panel>

        <Panel title="Themes">
          <div className="space-y-4">
            {clustering.themes.map((theme) => (
              <div key={theme.name} className="border-b border-border/60 pb-4 last:border-0 last:pb-0">
                <p className="text-sm font-medium">{theme.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {theme.terms.map((t) => t.term).join(", ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {theme.questions.length} candidate question
                  {theme.questions.length === 1 ? "" : "s"} · mentioned in{" "}
                  {theme.neutralAnswers.runsMentioning}/{theme.neutralAnswers.runsScanned} neutral
                  runs, {theme.brandGroundedAnswers.runsMentioning}/
                  {theme.brandGroundedAnswers.runsScanned} brand-grounded runs
                </p>
              </div>
            ))}
          </div>
        </Panel>

        {clustering.unclustered.length > 0 ? (
          <Panel title="Unclustered terms">
            <p className="mb-2 text-xs text-muted-foreground">
              Matched no theme in the taxonomy -- not force-fit, kept explicit.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {clustering.unclustered.slice(0, 40).map((t) => (
                <span
                  key={t.term}
                  className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                >
                  {t.term}
                </span>
              ))}
            </div>
          </Panel>
        ) : null}
      </main>
    </div>
  );
}
