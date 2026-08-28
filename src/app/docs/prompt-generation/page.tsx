import Link from "next/link";
import { Panel } from "@/components/dashboard/Panel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";

export default function PromptGenerationDocPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link href="/docs" className="text-sm text-link hover:underline">
            ← Documentation
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Prompt generation</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How the text that actually gets sent to Gemini is built -- two independent
            generators, deliberately opposite in design. For what the resulting answers are
            scored on, see{" "}
            <Link href="/methodology#aeo" className="text-link hover:underline">
              the AEO methodology
            </Link>
            .
          </p>
        </div>

        <Panel id="neutral" title="Neutral AEO prompts (src/aeo/promptGenerator.ts)">
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              Built as a cross-product of dimensions, cycled round-robin (not randomized, so a
              run is reproducible): 5 intents, 5 personas (solo founder, eng lead, PM,
              freelancer, marketing team), 5 attribute anchors (price, speed/UX, integrations,
              methodology, none), and language alternating en/es by index parity. Each of 6
              templates (5 intents + a control) exists in both languages.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Intent</th>
                    <th className="py-2 pr-4 font-medium">Template (en)</th>
                    <th className="py-2 font-medium">Brands named</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">discovery</td>
                    <td className="py-2 pr-4">&quot;What {"{category}"} tools exist for {"{persona}"}?&quot;</td>
                    <td className="py-2">none</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">recommendation_constraint</td>
                    <td className="py-2 pr-4">&quot;What&apos;s the best {"{category}"} tool for {"{persona}"} that needs {"{attribute}"}?&quot;</td>
                    <td className="py-2">none</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">direct_comparison</td>
                    <td className="py-2 pr-4">&quot;{"{brandA}"} vs {"{brandB}"}, which one should I choose?&quot;</td>
                    <td className="py-2">2 (audited brand + 1 competitor)</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">final_decision</td>
                    <td className="py-2 pr-4">&quot;Between {"{brandA}"}, {"{brandB}"}, and {"{brandC}"}, which one do you recommend?&quot;</td>
                    <td className="py-2">3 (audited brand + 2 competitors)</td>
                  </tr>
                  <tr className="border-b border-border/60">
                    <td className="py-2 pr-4 font-medium text-foreground">troubleshooting_replacement</td>
                    <td className="py-2 pr-4">&quot;What are some alternatives to {"{brandA}"} that offer {"{attribute}"}?&quot;</td>
                    <td className="py-2">1, alternating between a competitor and the audited brand itself</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 font-medium text-foreground">adversarial_control</td>
                    <td className="py-2 pr-4">&quot;How should {"{persona}"} organize their team&apos;s work?&quot;</td>
                    <td className="py-2">none, doesn&apos;t even name the category</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p>
              <span className="font-medium text-foreground">Sizing:</span> a reserved slice of{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">max(2, round(promptCount × 0.15))</code>{" "}
              prompts always goes to the adversarial_control template (a bias check -- does the
              model just answer generically without leaning on any brand), the rest cycle through
              the other 5 intents. Quick mode (<code className="rounded bg-muted px-1 py-0.5 text-xs">promptCount=10</code>,{" "}
              <code className="rounded bg-muted px-1 py-0.5 text-xs">runsPerPrompt=3</code>) produces 10 prompts × 3 runs = 30
              Gemini calls; full mode (24 prompts × 6 runs) produces 144.
            </p>
          </div>
        </Panel>

        <Panel id="hook-grounded" title="Brand-grounded, Part 1 — hook-grounded (src/questionGenerator/templates.ts)">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Every scanned hook (see{" "}
              <Link href="/docs/data-lake" className="text-link hover:underline">
                data ingestion
              </Link>{" "}
              for where hooks come from) gets run through <span className="font-medium text-foreground">every</span> template
              in its size class -- not one template picked at random. A hook over 6 words
              (a meta description, a GEO definition) is treated as sentence-length and gets the 2{" "}
              <span className="font-medium text-foreground">long-form</span> templates, which
              quote it directly (&quot;What tool matches this description: &quot;{"{hook}"}&quot;?&quot;). A
              short hook (a recurring tagcloud term) gets the 4{" "}
              <span className="font-medium text-foreground">short-phrase</span> templates instead
              (&quot;What tool would you recommend for a team that wants &quot;{"{hook}"}&quot;?&quot;, etc.) --
              splicing a full sentence into a short-phrase template read as broken English, found
              running this against real scraped data.
            </p>
            <p>
              This is why a product&apos;s hook <em>count</em> and its hook-question{" "}
              <em>count</em> differ so much (e.g. ~24 hooks -&gt; ~90 questions): most hooks are
              short tagcloud terms, each multiplied by 4 templates.
            </p>
          </div>
        </Panel>

        <Panel id="inferential" title="Brand-grounded, Part 2 — inferential (src/questionGenerator/inferentialTemplates.ts)">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Built from problem/audience claims (see{" "}
              <Link href="/docs/skills#user-question-generator" className="text-link hover:underline">
                user-question-generator
              </Link>
              ), never quoting the site directly. Templates are split by awareness stage:{" "}
              <span className="font-medium text-foreground">pain_only</span> (4 templates -- states
              the pain, no solution ask), <span className="font-medium text-foreground">problem_framed</span> (4
              templates -- names the problem, asks how to solve it), and{" "}
              <span className="font-medium text-foreground">comparing_with_criteria</span> (4
              templates -- solution-aware; 2 of the 4 need 2+ named competitors to produce a real
              named comparison rather than a criteria-only question).
            </p>
            <p>
              Whichever awareness stage a question lands in is what each product&apos;s prompts
              page groups by, and what the brand-grounded metrics break results down by instead of the
              neutral pipeline&apos;s intent/persona/specificity dimensions -- see{" "}
              <Link href="/methodology#brand-grounded" className="text-link hover:underline">
                why the two tables use different breakdowns
              </Link>
              .
            </p>
          </div>
        </Panel>
      </main>
    </div>
  );
}
