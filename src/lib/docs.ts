/**
 * Registry of project documentation pages, under /docs/{slug} -- the single
 * source of truth for both the /docs index and the site-wide footer, so a
 * new doc page is one entry here rather than two places to keep in sync.
 */
export interface DocEntry {
  slug: string;
  title: string;
  description: string;
}

export const DOCS: DocEntry[] = [
  {
    slug: "data-lake",
    title: "Data sources, ingestion & data lake structure",
    description:
      "Where the data comes from, how the scraper turns a site into the data lake, and what each folder holds.",
  },
  {
    slug: "skills",
    title: "Claude Code skills in use",
    description:
      "The three skills that build the data lake into reports, questions, and term clusters -- what each does and how they connect.",
  },
  {
    slug: "prompt-generation",
    title: "Prompt generation",
    description:
      "How the neutral AEO prompts and the brand-grounded (hook/inferential) questions are actually built, template by template.",
  },
];
