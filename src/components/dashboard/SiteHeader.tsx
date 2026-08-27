import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Brand Visibility Audit
        </Link>
        <span className="text-xs text-muted-foreground">SEO · GEO · AEO</span>
      </div>
    </header>
  );
}
