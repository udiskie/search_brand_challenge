import Link from "next/link";
import { Panel } from "@/components/dashboard/Panel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";

const TREE = `datalake/{product}/
  raw/                          # scraper output -- untouched by anything downstream
    sitemap.xml
    pages/{url_hash}.html
    pages/{url_hash}.meta.json  # fetch status, timestamp, response headers

  extracted/                    # SEO-facing signals, derived from raw/
    pages_index.json            # url, title, page-type (home/pricing/blog/docs/other)
    structured_signals.json     # title/meta/schema/headings/links/images/word count
    tagcloud.json                # tf-idf keywords, site-wide + per page, with raw occurrence counts
    phrase_cloud.json           # sentences where each top keyword actually appears
    sitemap_coverage.json       # broken/skipped sitemap URLs

  geo/                          # GEO signals, derived from raw/ -- see /methodology#geo
    geo_signals.json            # entity clarity, factual density, E-E-A-T proxies, structure

  questions/                    # candidate AEO probes generated from extracted/ + geo/ -- no Gemini calls
    candidate_user_questions.json
    candidate_user_questions.md

  clusters/                     # tagcloud terms grouped into named themes
    theme_clusters.taxonomy.json
    theme_clusters.llm.json

  aeo/                          # the Gemini probe layer
    prompts_config.json         # the generated neutral prompt set
    runs/{run_id}.json          # every raw neutral Gemini response -- the audit trail
    aggregated_metrics.json
    brand_grounded_metrics.json # optional (Step 2b)
    brand_grounded_runs/{run_id}.json

  report/                       # the final consolidated report
    report.json
    report.md
    priorities.json`;

export default function DataLakeDocPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link href="/docs" className="text-sm text-link hover:underline">
            ← Documentation
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            Data sources, ingestion & data lake structure
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Where every number on a report ultimately comes from, before any scoring is applied
            -- for how the scores themselves are computed, see the{" "}
            <Link href="/methodology" className="text-link hover:underline">
              methodology page
            </Link>
            .
          </p>
        </div>

        <Panel id="sources" title="Data sources">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Each product&apos;s own public
              website</span> is the primary and only crawl source. There is no third-party API --
              the scraper discovers URLs from the site&apos;s own <code className="rounded bg-muted px-1 py-0.5 text-xs">sitemap.xml</code>,
              then fetches each page directly.
            </p>
            <p>
              <span className="font-medium text-foreground">Gemini</span> is a second, distinct
              source, but only downstream at the AEO layer -- it&apos;s never crawled, it&apos;s
              asked questions (both neutral category questions and, optionally, questions grounded
              in the brand&apos;s own site content) and its answers are what gets measured. See{" "}
              <Link href="/methodology#aeo" className="text-link hover:underline">
                the AEO methodology
              </Link>{" "}
              for exactly what&apos;s asked.
            </p>
            <p>
              <span className="font-medium text-foreground">Nothing else is ingested</span> --
              no backlink data, no third-party mentions, no review-site listings (G2, Capterra),
              no social media. This is a deliberate scope decision, not an oversight, and it has a
              real consequence documented on the GEO methodology section: signals that require
              external reputation data (most notably E-E-A-T&apos;s Authoritativeness) can&apos;t be
              reliably measured from on-page content alone.
            </p>
          </div>
        </Panel>

        <Panel id="ingestion" title="Data ingestion — the scraper pipeline">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Entry point: <code className="rounded bg-muted px-1 py-0.5 text-xs">npm run scrape -- --product &lt;name&gt; --url &lt;site&gt; --mode quick|full</code>.
            </p>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Fetch <code className="rounded bg-muted px-1 py-0.5 text-xs">sitemap.xml</code> (sitemap indexes are followed, not just flat sitemaps).</li>
              <li>
                Select which URLs to actually crawl. <span className="font-medium text-foreground">Quick mode</span>{" "}
                (the default, and what every committed product used) caps the crawl to a small
                prioritized subset: the home page, up to 2 pricing pages, up to 2 docs pages, up to
                2 blog pages, then whatever&apos;s left filled in by highest sitemap{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">priority</code> -- non-English
                locale paths are deprioritized so a quick audit reflects the default site.{" "}
                <span className="font-medium text-foreground">Full mode</span> crawls everything
                the sitemap lists.
              </li>
              <li>Respect <code className="rounded bg-muted px-1 py-0.5 text-xs">robots.txt</code>, fetch with bounded concurrency, a per-request delay, and retries.</li>
              <li>Persist the raw HTML plus response metadata (status, timestamp) for every fetched page under <code className="rounded bg-muted px-1 py-0.5 text-xs">raw/pages/</code> -- nothing is discarded before extraction.</li>
              <li>
                Run every extractor against that crawled HTML in one pass: SEO signals, GEO
                signals, the tf-idf tagcloud + phrase cloud, the page index, and sitemap coverage
                stats -- written to <code className="rounded bg-muted px-1 py-0.5 text-xs">extracted/</code> and{" "}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">geo/</code>.
              </li>
            </ol>
            <p>
              Everything past this point -- candidate questions, term clustering, the AEO Gemini
              probe, the final report -- is a separate command that reads this already-scraped base
              layer rather than re-crawling the live site. That split means a report can be
              regenerated, or a new batch of brand-grounded questions probed, without ever hitting
              the product&apos;s website again.
            </p>
          </div>
        </Panel>

        <Panel id="structure" title="Data lake structure">
          <p className="mb-3 text-sm text-muted-foreground">
            One directory per product under <code className="rounded bg-muted px-1 py-0.5 text-xs">/datalake</code>, split by layer --
            <code className="rounded bg-muted px-1 py-0.5 text-xs">raw/</code>,{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">extracted/</code>, and{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">geo/</code> come from the
            scraper; everything else is produced by a separate, independently re-runnable command
            against that base layer.
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs leading-relaxed">
            {TREE}
          </pre>
        </Panel>
      </main>
    </div>
  );
}
