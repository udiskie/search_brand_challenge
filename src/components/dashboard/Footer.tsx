import Link from "next/link";
import { DOCS } from "@/lib/docs";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-6 py-4 text-xs text-muted-foreground">
        <span>Documentation:</span>
        {DOCS.map((doc) => (
          <Link key={doc.slug} href={doc.href ?? `/docs/${doc.slug}`} className="text-link hover:underline">
            {doc.title}
          </Link>
        ))}
      </div>
    </footer>
  );
}
