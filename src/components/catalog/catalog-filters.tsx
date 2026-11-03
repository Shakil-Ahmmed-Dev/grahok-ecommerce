"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Filter, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { TCategoryTreeNode } from "@/features/categories/types";
import type { TProductFacets } from "@/features/products/types";

interface CatalogFiltersProps {
  categories: TCategoryTreeNode[];
  facets?: TProductFacets;
  selectedCategory?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
}

export function CatalogFilters({
  categories,
  facets,
  selectedCategory,
  minPrice: initialMinPrice = "",
  maxPrice: initialMaxPrice = "",
  inStock: initialInStock = "",
}: CatalogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [minPrice, setMinPrice] = React.useState(initialMinPrice);
  const [maxPrice, setMaxPrice] = React.useState(initialMaxPrice);
  const [inStockOnly, setInStockOnly] = React.useState(initialInStock === "true");
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [, startTransition] = React.useTransition();

  const [prevProps, setPrevProps] = React.useState({
    minPrice: initialMinPrice,
    maxPrice: initialMaxPrice,
    inStock: initialInStock,
  });

  if (
    prevProps.minPrice !== initialMinPrice ||
    prevProps.maxPrice !== initialMaxPrice ||
    prevProps.inStock !== initialInStock
  ) {
    setPrevProps({
      minPrice: initialMinPrice,
      maxPrice: initialMaxPrice,
      inStock: initialInStock,
    });
    setMinPrice(initialMinPrice);
    setMaxPrice(initialMaxPrice);
    setInStockOnly(initialInStock === "true");
  }

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1"); // Reset pagination on filter change

    Object.entries(updates).forEach(([key, val]) => {
      if (val === undefined || val === "") {
        params.delete(key);
      } else {
        params.set(key, val);
      }
    });

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handlePriceApply = (e: React.FormEvent) => {
    e.preventDefault();
    updateFilters({
      minPrice: minPrice.trim() || undefined,
      maxPrice: maxPrice.trim() || undefined,
    });
    setMobileOpen(false);
  };

  const handleCategorySelect = (slug: string) => {
    const next = selectedCategory === slug ? undefined : slug;
    updateFilters({ category: next });
    setMobileOpen(false);
  };

  const handleInStockToggle = () => {
    const next = !inStockOnly;
    setInStockOnly(next);
    updateFilters({ inStock: next ? "true" : undefined });
  };

  const handleReset = () => {
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
    startTransition(() => {
      router.push(pathname);
    });
    setMobileOpen(false);
  };

  const hasActiveFilters = Boolean(
    selectedCategory || initialMinPrice || initialMaxPrice || initialInStock === "true"
  );

  const FilterContent = (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-green)] flex items-center gap-2">
          <Filter className="size-4" />
          <span>Catalog Filters</span>
        </h3>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="text-xs font-semibold text-[var(--brand-accent)] hover:underline flex items-center gap-1 transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Category Facet */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[rgba(0,0,0,0.87)]">
          Departments
        </h4>
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.slug;
            const facetCount = facets?.categories?.find((f) => f.slug === cat.slug)?.count;
            return (
              <React.Fragment key={cat.id}>
                <button
                  type="button"
                  onClick={() => handleCategorySelect(cat.slug)}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold text-left transition-all ${
                    isSelected
                      ? "bg-[var(--brand-accent)] text-white shadow-2xs"
                      : "hover:bg-[var(--brand-ceramic)] text-[rgba(0,0,0,0.87)]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-3.5 rounded-full border flex items-center justify-center transition-transform ${
                        isSelected
                          ? "border-white bg-white text-[var(--brand-accent)] scale-110"
                          : "border-[var(--border)]"
                      }`}
                    >
                      {isSelected && <Check className="size-2.5 stroke-[3]" />}
                    </div>
                    <span>{cat.name}</span>
                  </div>
                  {facetCount !== undefined && (
                    <span
                      className={`text-[11px] tabular-nums ${
                        isSelected ? "text-white/90" : "text-[rgba(0,0,0,0.58)]"
                      }`}
                    >
                      {facetCount}
                    </span>
                  )}
                </button>
                {cat.children && cat.children.length > 0 && cat.children.map((child) => {
                  const isChildSelected = selectedCategory === child.slug;
                  const childFacetCount = facets?.categories?.find((f) => f.slug === child.slug)?.count;
                  return (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => handleCategorySelect(child.slug)}
                      className={`flex items-center justify-between rounded-lg pl-7 pr-3 py-1.5 text-xs text-left transition-all ${
                        isChildSelected
                          ? "bg-[var(--brand-mint)]/50 text-[var(--brand-green)] font-bold"
                          : "hover:bg-[var(--brand-ceramic)]/60 text-[rgba(0,0,0,0.65)] hover:text-[rgba(0,0,0,0.87)]"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={`size-2.5 rounded-full border flex items-center justify-center shrink-0 ${
                            isChildSelected
                              ? "border-[var(--brand-green)] bg-[var(--brand-green)]"
                              : "border-[var(--border)]"
                          }`}
                        />
                        <span className="truncate">{child.name}</span>
                      </div>
                      {childFacetCount !== undefined && (
                        <span className="text-[10px] tabular-nums text-[rgba(0,0,0,0.58)] ml-2 shrink-0">
                          {childFacetCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Availability Toggle */}
      <div className="flex flex-col gap-2.5 pt-4 border-t border-[var(--border)]">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[rgba(0,0,0,0.87)]">
          Availability
        </h4>
        <label className="flex items-center gap-2.5 text-xs font-medium text-[rgba(0,0,0,0.87)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={handleInStockToggle}
            className="size-4 rounded accent-[var(--brand-accent)] cursor-pointer"
          />
          <span>In Stock Only</span>
        </label>
      </div>

      {/* Price Range */}
      <div className="flex flex-col gap-3 pt-4 border-t border-[var(--border)]">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[rgba(0,0,0,0.87)]">
          Price Range (BDT)
        </h4>
        <form onSubmit={handlePriceApply} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-9 text-xs tabular-nums bg-white"
              min={0}
            />
            <span className="text-[rgba(0,0,0,0.58)] text-xs">&ndash;</span>
            <Input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-9 text-xs tabular-nums bg-white"
              min={0}
            />
          </div>
          <Button type="submit" variant="default" size="sm" className="h-8 text-xs font-semibold">
            Apply Price
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 pr-6 border-r border-[var(--border)]">
        {FilterContent}
      </aside>

      {/* Mobile Trigger Button and Drawer */}
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-9 text-xs font-semibold">
              <Filter className="size-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="size-2 rounded-full bg-[var(--brand-accent)]" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[310px] p-6 bg-[var(--brand-cream)]">
            <SheetHeader className="text-left border-b border-[var(--border)] pb-4">
              <SheetTitle className="text-base font-bold text-[var(--brand-green)]">
                Filter Catalog
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6">{FilterContent}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
