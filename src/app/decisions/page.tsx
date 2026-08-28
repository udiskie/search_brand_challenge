import fs from "node:fs/promises";
import path from "node:path";
import Link from "next/link";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Panel } from "@/components/dashboard/Panel";
import { SiteHeader } from "@/components/dashboard/SiteHeader";

async function readDecisions() {
  const filePath = path.join(process.cwd(), "DECISIONS.md");
  return fs.readFile(filePath, "utf-8");
}

export default async function DecisionsPage() {
  const content = await readDecisions();

  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <Link href="/" className="text-sm text-link hover:underline">
          ← All products
        </Link>
        <Panel className="mt-4">
          <article className="prose prose-sm dark:prose-invert max-w-none prose-headings:scroll-mt-6 prose-a:text-link prose-a:no-underline hover:prose-a:underline">
            <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
          </article>
        </Panel>
      </main>
    </div>
  );
}
