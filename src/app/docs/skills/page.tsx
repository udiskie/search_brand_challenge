import Link from "next/link";
import { Panel } from "@/components/dashboard/Panel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";

export default function SkillsDocPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link href="/docs" className="text-sm text-link hover:underline">
            ← Documentation
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Claude Code skills in use</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            A skill here is a packaged, repeatable workflow under{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">.claude/skills/</code> that Claude
            follows to turn the{" "}
            <Link href="/docs/data-lake" className="text-link hover:underline">
              data lake
            </Link>{" "}
            into something usable. Three exist, each producing one layer of the data lake and
            feeding the next.
          </p>
        </div>

        <Panel id="brand-visibility-audit" title="brand-visibility-audit">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              The orchestrating skill, and the one that produces everything documented on the{" "}
              <Link href="/methodology" className="text-link hover:underline">
                methodology page
              </Link>
              . Given a product, its competitors, and a category, it: runs the scraper if the
              data lake is empty, generates the neutral AEO prompt set, calls Gemini repeatedly
              per prompt, extracts brand mentions and computes Share of Voice/position/sentiment,
              cross-validates the answers against the site&apos;s own tagcloud, and writes the
              final <code className="rounded bg-muted px-1 py-0.5 text-xs">report/</code>{" "}
              (scores, findings, priority matrix).
            </p>
            <p>
              A second, explicitly opt-in step (Step 2b) also runs candidate questions from{" "}
              <span className="font-medium text-foreground">user-question-generator</span> through
              Gemini as a separate, brand-grounded pass -- see{" "}
              <Link href="/methodology#brand-grounded" className="text-link hover:underline">
                why that table is never compared to the neutral one
              </Link>
              .
            </p>
          </div>
        </Panel>

        <Panel id="user-question-generator" title="user-question-generator">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Scans a product&apos;s already-scraped content (meta descriptions, GEO definitions,
              recurring tagcloud terms, problem/audience phrasing) to generate candidate
              questions grounded in that brand&apos;s own site -- the opposite of
              brand-visibility-audit&apos;s neutral prompt generator, on purpose. Produces two
              derivatives: <span className="font-medium text-foreground">hook-grounded</span>{" "}
              questions that quote the site&apos;s own phrasing back, and{" "}
              <span className="font-medium text-foreground">inferential</span> questions that
              paraphrase the site&apos;s stated problem/audience without quoting it, split by
              awareness stage.
            </p>
            <p>
              Nothing here calls Gemini -- it&apos;s a reviewable candidate list. It only reaches
              Gemini if brand-visibility-audit&apos;s Step 2b is run against it, which is where{" "}
              <Link href="/methodology#brand-grounded" className="text-link hover:underline">
                the methodology
              </Link>{" "}
              for how those questions get scored lives.
            </p>
          </div>
        </Panel>

        <Panel id="term-clustering" title="term-clustering">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Groups a product&apos;s flat tagcloud terms (tf-idf keywords with no notion of
              meaning) into named semantic themes, using either a hand-curated taxonomy or an LLM
              call -- built as a deliberate side-by-side comparison of both methods. Each theme is
              then correlated against user-question-generator&apos;s candidate questions and
              brand-visibility-audit&apos;s raw Gemini answers (both neutral and brand-grounded),
              surfacing which topics get generated questions but never actually show up in what
              Gemini says -- a theme-level GEO gap.
            </p>
            <p>
              This is the source of the Sankey diagram and treemap on each product&apos;s clusters
              page, linked from{" "}
              <Link href="/" className="text-link hover:underline">
                its report
              </Link>
              . The correlation counts reference the same Share-of-Voice-style run data the{" "}
              <Link href="/methodology#aeo" className="text-link hover:underline">
                AEO methodology
              </Link>{" "}
              describes, just grouped by theme instead of brand.
            </p>
          </div>
        </Panel>
      </main>
    </div>
  );
}
