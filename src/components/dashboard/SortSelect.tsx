"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface SortOption<T extends string> {
  value: T;
  label: string;
}

/** A labeled "Sort by" dropdown for reordering a list client-side. */
export function SortSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SortOption<T>[];
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <label htmlFor="sort-by" className="whitespace-nowrap">
        Sort by
      </label>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id="sort-by" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
