"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  totalPages: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
}

export function Pagination({
  page,
  totalPages,
  hasNextPage,
  hasPrevPage,
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();

  if (totalPages <= 1) return null;

  const navigateToPage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === page) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", targetPage.toString());

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Generate numbered pages array
  const pages: (number | string)[] = [];
  const delta = 1;
  const left = page - delta;
  const right = page + delta + 1;

  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= left && i < right)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <nav
      className="flex items-center justify-center gap-1.5 pt-8"
      aria-label="Pagination"
    >
      <Button
        variant="outline"
        size="icon"
        className="size-8"
        disabled={!hasPrevPage && page <= 1}
        onClick={() => navigateToPage(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft className="size-4" />
      </Button>

      {pages.map((p, idx) =>
        typeof p === "number" ? (
          <Button
            key={idx}
            variant={p === page ? "default" : "outline"}
            size="sm"
            className="size-8 p-0 text-xs tabular-nums"
            onClick={() => navigateToPage(p)}
            aria-current={p === page ? "page" : undefined}
          >
            {p}
          </Button>
        ) : (
          <span
            key={idx}
            className="px-1 text-xs text-muted-foreground select-none"
          >
            ...
          </span>
        )
      )}

      <Button
        variant="outline"
        size="icon"
        className="size-8"
        disabled={!hasNextPage && page >= totalPages}
        onClick={() => navigateToPage(page + 1)}
        aria-label="Next page"
      >
        <ChevronRight className="size-4" />
      </Button>
    </nav>
  );
}
