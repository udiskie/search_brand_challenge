import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandGroundedPromptsPanel } from "@/components/dashboard/BrandGroundedPromptsPanel";
import { NeutralPromptsPanel } from "@/components/dashboard/NeutralPromptsPanel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";
import {
  getBrandGroundedRuns,
  getNeutralPromptsConfig,
  getNeutralRuns,
} from "@/lib/dashboardData";

export default async function PromptsPage(props: PageProps<"/products/[product]/prompts">) {
  const { product } = await props.params;

  const [promptsConfig, neutralRuns, brandGroundedRuns] = await Promise.all([
    getNeutralPromptsConfig(product),
    getNeutralRuns(product),
    getBrandGroundedRuns(product),
  ]);

  if (!promptsConfig && brandGroundedRuns.length === 0) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link
            href={`/products/${product}`}
            className="text-sm text-link hover:underline"
          >
            ← Back to report
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight capitalize">
            {product} — prompts sent to Gemini
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every prompt and raw response is saved before any parsing — this is the
            auditable dataset the metrics on the report page are computed from.
          </p>
        </div>

        {promptsConfig ? (
          <NeutralPromptsPanel
            prompts={promptsConfig.prompts}
            runs={neutralRuns}
            runsPerPrompt={promptsConfig.config.runsPerPrompt}
          />
        ) : null}

        {brandGroundedRuns.length > 0 ? (
          <BrandGroundedPromptsPanel runs={brandGroundedRuns} />
        ) : null}
      </main>
    </div>
  );
}
