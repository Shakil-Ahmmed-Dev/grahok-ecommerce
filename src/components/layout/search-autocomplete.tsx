"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Loader2, Tag, Folder, ArrowRight } from "lucide-react";
import { ProductImage } from "@/components/ui/product-image";
import { formatCurrencyBDT } from "@/lib/utils";
import type { TProductSuggestions } from "@/features/products/types";

export function SearchAutocomplete() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [suggestions, setSuggestions] = React.useState<TProductSuggestions | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search query
  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      const resetTimer = setTimeout(() => {
        setSuggestions(null);
        setIsLoading(false);
      }, 0);
      return () => clearTimeout(resetTimer);
    }

    const timeout = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/products/suggest?q=${encodeURIComponent(trimmed)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          const parsed = data.data || data;
          setSuggestions(parsed && Array.isArray(parsed.products) ? parsed : null);
          setIsOpen(true);
        }
      } catch {
        // Ignore fetch errors
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed) {
      setIsOpen(false);
      router.push(`/products?search=${encodeURIComponent(trimmed)}`);
    }
  };

  const handleSelect = () => {
    setIsOpen(false);
  };

  const hasSuggestions =
    suggestions &&
    (suggestions.products.length > 0 ||
      suggestions.categories.length > 0 ||
      suggestions.tags.length > 0);

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen && e.target.value.trim().length >= 2) setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions && query.trim().length >= 2) setIsOpen(true);
          }}
          placeholder="Search products, categories..."
          className="h-10 w-full rounded-full border border-border bg-muted/40 pl-10 pr-10 text-sm placeholder:text-muted-foreground focus:border-foreground focus:bg-background focus:outline-none transition-colors"
        />
        <Search className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground" />
        {isLoading && (
          <Loader2 className="pointer-events-none absolute right-3.5 size-4 animate-spin text-muted-foreground" />
        )}
      </form>

      {/* Suggestion Popover */}
      {isOpen && hasSuggestions && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
          {/* Categories */}
          {suggestions.categories.length > 0 && (
            <div className="p-3 border-b border-border bg-muted/20">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
                Categories
              </span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {suggestions.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/categories/${cat.slug}`}
                    onClick={handleSelect}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    <Folder className="size-3 text-muted-foreground" />
                    <span>{cat.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {suggestions.products.length > 0 && (
            <div className="p-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1 block">
                Products
              </span>
              <div className="flex flex-col gap-1">
                {suggestions.products.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/products/${prod.slug}`}
                    onClick={handleSelect}
                    className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted transition-colors"
                  >
                    <div className="relative size-11 rounded-md overflow-hidden bg-muted shrink-0 border">
                      <ProductImage
                        src={prod.featuredImageUrl}
                        alt={prod.name}
                        fill
                        className="object-cover"
                        sizes="44px"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {prod.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {prod.category || "In Store"}
                      </div>
                    </div>
                    <div className="text-sm font-semibold tabular-nums text-foreground">
                      {formatCurrencyBDT(prod.sellPrice)}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {suggestions.tags.length > 0 && (
            <div className="p-3 border-t border-border bg-muted/10">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2">
                Popular Tags
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {suggestions.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/products?search=${encodeURIComponent(tag)}`}
                    onClick={handleSelect}
                    className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Tag className="size-2.5" />
                    <span>{tag}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Bottom All Results */}
          <div className="border-t border-border p-2 bg-muted/30">
            <button
              onClick={handleSubmit}
              className="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs font-medium text-primary hover:bg-muted transition-colors"
            >
              <span>View all results for &ldquo;{query}&rdquo;</span>
              <ArrowRight className="size-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
