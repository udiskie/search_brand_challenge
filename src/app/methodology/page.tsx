import { CircleCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Panel } from "@/components/dashboard/Panel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";

const EEAT_BREAKDOWN: {
  letter: string;
  name: string;
  status: "proxied" | "reliable";
  detail: string;
}[] = [
  {
    letter: "E",
    name: "Experience",
    status: "proxied",
    detail:
      "Detects testimonials, case studies, or screenshots on the page -- can't verify whether they reflect real experience or are just marketing copy.",
  },
  {
    letter: "E",
    name: "Expertise",
    status: "proxied",
    detail:
      "Checks technical precision of the copy, presence of documentation, and an author bio when one exists -- self-declared, with no external credential to confirm it.",
  },
  {
    letter: "A",
    name: "Authoritativeness",
    status: "proxied",
    detail:
      "The weakest of the four: real authoritativeness needs backlinks, third-party mentions, or listings on recognized directories. None of that is collected here, so this is effectively unmeasured.",
  },
  {
    letter: "T",
    name: "Trustworthiness",
    status: "reliable",
    detail:
      "Directly checked against the page's own HTML: a visible author byline, and publish/update dates. The only component where the on-page signal actually approaches what it claims to measure.",
  },
];

export default function MethodologyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link href="/" className="text-sm text-link hover:underline">
            ← All products
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Assessment methodology</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How each score and table on a product report is computed, so the numbers can be
            checked without reading the implementation.
          </p>
        </div>

        <Panel id="scores" title="SEO / GEO / AEO scores">
          <p className="text-sm text-muted-foreground">
            Every score is 0–100, computed per crawled page and then averaged across the
            product&apos;s pages. Labels: 80+ is <span className="text-foreground">good</span>,
            below 80 is <span className="text-foreground">needs work</span>.
          </p>
        </Panel>

        <Panel id="aeo" title="AEO — Share of Voice (neutral)">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Prompts are generated from a cross-product of dimensions — intent (discovery,
              direct comparison, recommendation-with-constraint, troubleshooting, final
              decision, adversarial control), persona, specificity, attribute anchor
              (price/speed/integrations/methodology/none), and language (en/es) — and{" "}
              <span className="text-foreground">
                never mention any brand by name or quote any brand&apos;s own copy
              </span>
              . Each prompt is sent to Gemini multiple times (3 runs in quick mode, 6 in full)
              at temperature 0.9. Every competitor has an equal a-priori shot at being
              surfaced, which is what makes this a fair benchmark.
            </p>
            <dl className="space-y-1.5">
              <div>
                <dt className="font-medium text-foreground">Share of Voice (SoV)</dt>
                <dd># runs where the brand is mentioned at all ÷ total runs.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Relative SoV</dt>
                <dd>
                  brand SoV ÷ average SoV of the other tracked brands. If no competitor is ever
                  mentioned, that average is floored at 1/totalRuns instead of 0.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Average position</dt>
                <dd>
                  Mean 1-indexed mention order (by first occurrence in the response text),
                  across runs where the brand appears. Blank if never mentioned.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">First-mention rate</dt>
                <dd># runs where the brand is the first brand mentioned ÷ total runs.</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Sentiment</dt>
                <dd>
                  Mean per-mention sentiment, scored positive = +1 / neutral = 0 / negative = −1.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">AEO score (0–100)</dt>
                <dd>60% × (brand SoV × 100) + 40% × (sentiment normalized to 0–100).</dd>
              </div>
            </dl>
            <p>
              Mention extraction is heuristic keyword/context matching, not a second Gemini
              call to structure the response — fast and free, but it can miss indirect
              phrasing (sarcasm, a brand referred to only by a pronoun).
            </p>
          </div>
        </Panel>

        <Panel id="brand-grounded" title="Brand-grounded question performance (not neutral)">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              This table reuses the exact same SoV/relative-SoV/position/first-mention/
              sentiment formulas as the neutral AEO table above, but on a{" "}
              <span className="text-foreground">deliberately different prompt set</span>: one
              built by scanning the audited brand&apos;s own site content, not neutral category
              templates.
            </p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium text-foreground">Hook-grounded</span> — literal
                marketing phrases lifted from the brand&apos;s own copy, turned into a question
                that quotes or closely echoes them back. A floor signal: surfacing the brand
                here may just mean the model recognized indexed text, not that it reasoned
                about fit.
              </li>
              <li>
                <span className="font-medium text-foreground">Inferential</span> — the site&apos;s
                stated problem/audience claims, paraphrased into a generic need without
                quoting the site, split by awareness stage. The stronger of the two signals,
                since it requires genuinely inferring fit.
              </li>
            </ul>
            <p className="text-foreground">
              Never compare these two tables directly. The neutral table asks &quot;what
              should a real category searcher use?&quot;; this one asks &quot;how does this
              brand do on questions built from its own positioning?&quot; A high
              brand-grounded SoV next to a lower neutral SoV is the expected shape, not a
              contradiction — and it never feeds into the overall scores or priority matrix.
            </p>
          </div>
        </Panel>

        <Panel id="seo" title="SEO score">
          <p className="text-sm text-muted-foreground">
            Average of four sub-scores, per page: H1 present exactly once (100/0), meta
            description present and ≥50 characters (100/50/0), any schema.org markup present
            (100/0), and % of images with alt text — minus a penalty of{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">min(30, 5 × broken sitemap URLs)</code>.
          </p>
        </Panel>

        <Panel id="geo" title="GEO score">
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Average of four sub-scores, per page: a self-contained brand definition present
              (100/0), factual-density score × 100 (concrete numbers/comparisons vs. vague
              promotional adjectives), an E-E-A-T sub-score (visible author, publish date,
              update date each worth up to ~33), and an extractable-structure score × 100
              (lists/tables/definition blocks present).
            </p>

            <div className="flex items-start gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">E-E-A-T here is only partially measured</p>
                <p className="mt-1 text-red-700 dark:text-red-400">
                  Every signal comes from the audited site&apos;s own crawled pages — there is
                  no external data source (backlinks, third-party mentions, review-site
                  listings). Two of the four E-E-A-T components are, by definition, about
                  outside reputation, so they can&apos;t be reliably assessed from on-page
                  content alone. This is a structural proxy, not the full E-E-A-T
                  construct Google evaluates.
                </p>
              </div>
            </div>

            <ul className="space-y-2">
              {EEAT_BREAKDOWN.map((item) => (
                <li key={item.name} className="flex items-start gap-2.5">
                  {item.status === "proxied" ? (
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-red-600 dark:text-red-400" />
                  ) : (
                    <CircleCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  )}
                  <span className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.letter}</span>
                    <span className="font-medium text-foreground">
                      {item.name.slice(1)}
                    </span>{" "}
                    —{" "}
                    <span
                      className={
                        item.status === "proxied"
                          ? "font-medium text-red-700 dark:text-red-400"
                          : "font-medium text-emerald-700 dark:text-emerald-400"
                      }
                    >
                      {item.status === "proxied" ? "proxied" : "directly measured"}
                    </span>
                    : {item.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel id="word-occurrences" title="Word occurrences">
          <p className="text-sm text-muted-foreground">
            A raw count of how many times each term appears across the product&apos;s crawled
            pages — separate from the tf-idf tagcloud ranking used for term clustering
            elsewhere, which weights rare-but-distinctive terms above frequent generic ones.
            This is just the plain occurrence count, useful for a sanity check against the
            weighted ranking.
          </p>
        </Panel>

        <Panel id="priority-matrix" title="Priority matrix (impact × effort)">
          <p className="text-sm text-muted-foreground">
            Every finding across SEO, GEO, and AEO is tagged with a dimension, impact
            (high/medium/low), effort (low/medium/high), and a suggested action, then sorted
            impact-first (high → low) with effort as a low-to-high tiebreak — so the top rows
            are always the highest-leverage fixes.
          </p>
        </Panel>
      </main>
    </div>
  );
}
