"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "publishedAt-desc", label: "Newest Arrivals", sortBy: "publishedAt", sortOrder: "desc" },
  { value: "sellPrice-asc", label: "Price: Low to High", sortBy: "sellPrice", sortOrder: "asc" },
  { value: "sellPrice-desc", label: "Price: High to Low", sortBy: "sellPrice", sortOrder: "desc" },
  { value: "name-asc", label: "Alphabetical: A to Z", sortBy: "name", sortOrder: "asc" },
  { value: "name-desc", label: "Alphabetical: Z to A", sortBy: "name", sortOrder: "desc" },
];

interface SortSelectProps {
  currentSortBy?: string;
  currentSortOrder?: string;
}

export function SortSelect({
  currentSortBy = "publishedAt",
  currentSortOrder = "desc",
}: SortSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();

  const currentValue = `${currentSortBy}-${currentSortOrder}`;

  const handleValueChange = (val: string) => {
    const selected = SORT_OPTIONS.find((opt) => opt.value === val);
    if (!selected) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", selected.sortBy);
    params.set("sortOrder", selected.sortOrder);
    params.set("page", "1");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="hidden sm:inline text-xs text-muted-foreground whitespace-nowrap">
        Sort by:
      </span>
      <Select value={currentValue} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[170px] h-9 text-xs">
          <SelectValue placeholder="Sort order" />
        </SelectTrigger>
        <SelectContent align="end">
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-xs">
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
