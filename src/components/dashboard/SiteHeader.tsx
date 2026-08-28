import Link from "next/link";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Brand Visibility Audit
        </Link>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" nativeButton={false} render={<Link href="/decisions" />}>
            Decisions
          </Button>
          <Button size="sm" nativeButton={false} render={<Link href="/docs" />}>
            Docs
          </Button>
        </div>
      </div>
    </header>
  );
}
