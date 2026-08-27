export function RunOutcome({ run }: { run: { error?: string; rawText: string | null } }) {
  if (run.error) {
    return <span className="text-red-700 dark:text-red-400">Error: {run.error}</span>;
  }
  const text = run.rawText ?? "";
  return <span>{text.length > 220 ? `${text.slice(0, 220)}…` : text}</span>;
}
