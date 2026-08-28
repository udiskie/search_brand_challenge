import Link from "next/link";
import { Panel } from "@/components/dashboard/Panel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";
import { DOCS } from "@/lib/docs";

export default function DocsIndexPage() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 space-y-6 px-6 py-10">
        <div>
          <Link href="/" className="text-sm text-link hover:underline">
            ← All products
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">Documentation</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            How this project actually works, beyond the per-report scoring
          </p>
        </div>

        <Panel>
          <ul className="divide-y divide-border/60">
            {DOCS.map((doc) => (
              <li key={doc.slug} className="py-3 first:pt-0 last:pb-0">
                <Link
                  href={doc.href ?? `/docs/${doc.slug}`}
                  className="text-sm font-medium text-link hover:underline"
                >
                  {doc.title}
                </Link>
                <p className="mt-0.5 text-xs text-muted-foreground">{doc.description}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </main>
    </div>
  );
}
