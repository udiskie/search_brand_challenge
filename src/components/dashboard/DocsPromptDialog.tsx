"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DOCS } from "@/lib/docs";

export function DocsPromptDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Opens post-mount (not during render) so the server-rendered markup
    // (dialog closed) matches the client on first paint, then the dialog
    // appears right after hydration on every load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
  }, []);

  function dismiss() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="p-8">
          <DialogTitle>New here? Start with the docs</DialogTitle>
          <DialogDescription>
            Before diving into a product&apos;s scores, it&apos;s worth reading the{" "}
            <Link href="/methodology" onClick={dismiss} className="text-link">
              assessment methodology
            </Link>{" "}
            to understand how SEO, GEO, and AEO scores are computed, plus these chapters:
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 p-8">
          {DOCS.map((doc) => (
            <li key={doc.slug}>
              <Link
                href={doc.href ?? `/docs/${doc.slug}`}
                onClick={dismiss}
                className="text-sm font-medium text-link hover:underline"
              >
                {doc.title}
              </Link>
              <p className="mt-0.5 text-xs text-muted-foreground">{doc.description}</p>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={dismiss}>
            Maybe later
          </Button>
          <Button
            size="sm"
            nativeButton={false}
            render={<Link href="/docs" onClick={dismiss} />}
          >
            Browse all docs
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
