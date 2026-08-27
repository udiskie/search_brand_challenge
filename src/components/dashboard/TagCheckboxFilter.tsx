"use client";

import { Checkbox } from "@/components/ui/checkbox";

export interface TagFilterGroup {
  label: string;
  /** Each option's `key` must be globally unique across all groups (e.g. "intent:discovery"). */
  options: { key: string; label: string }[];
}

/**
 * A flat list of checkboxes, grouped visually by dimension. Checking a box
 * adds it to the selection; matching against the selection is an AND across
 * every checked box (accumulating checkboxes narrows the results), left to
 * the caller.
 */
export function TagCheckboxFilter({
  groups,
  selected,
  onToggle,
}: {
  groups: TagFilterGroup[];
  selected: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2">
      {groups.map((group) => (
        <div key={group.label} className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="text-xs text-muted-foreground">{group.label}:</span>
          {group.options.map((option) => (
            <label
              key={option.key}
              className="flex cursor-pointer items-center gap-1.5 text-xs"
            >
              <Checkbox
                checked={selected.has(option.key)}
                onCheckedChange={() => onToggle(option.key)}
              />
              {option.label}
            </label>
          ))}
        </div>
      ))}
    </div>
  );
}
