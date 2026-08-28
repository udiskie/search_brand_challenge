import Link from "next/link";

/** Small link into the methodology page's matching section, meant for a Panel's `action` slot. */
export function MethodologyLink({ anchor }: { anchor: string }) {
  return (
    <Link href={`/methodology#${anchor}`} className="text-xs text-link hover:underline">
      Methodology →
    </Link>
  );
}
