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
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground flex items-center gap-2">
          <Filter className="size-4" />
          <span>Filters</span>
        </h3>
        {hasActiveFilters && (
          <button
            onClick={handleReset}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="size-3" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Category Facet */}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-foreground">Categories</h4>
        <div className="flex flex-col gap-1 max-h-56 overflow-y-auto pr-1">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.slug;
            const facetCount = facets?.categories?.find((f) => f.slug === cat.slug)?.count;
            return (
              <React.Fragment key={cat.id}>
                <button
                  type="button"
                  onClick={() => handleCategorySelect(cat.slug)}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-medium text-left transition-colors ${
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`size-3.5 rounded border flex items-center justify-center ${
                        isSelected
                          ? "border-primary-foreground bg-primary-foreground text-primary"
                          : "border-muted-foreground/40"
                      }`}
                    >
                      {isSelected && <Check className="size-2.5" />}
                    </div>
                    <span>{cat.name}</span>
                  </div>
                  {facetCount !== undefined && (
                    <span
                      className={`text-[11px] tabular-nums ${
                        isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
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
                      className={`flex items-center justify-between rounded-md pl-6 pr-2.5 py-1 text-xs text-left transition-colors ${
                        isChildSelected
                          ? "bg-primary/90 text-primary-foreground font-semibold"
                          : "hover:bg-muted/70 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <div
                          className={`size-3 rounded border flex items-center justify-center shrink-0 ${
                            isChildSelected
                              ? "border-primary-foreground bg-primary-foreground text-primary"
                              : "border-muted-foreground/30"
                          }`}
                        >
                          {isChildSelected && <Check className="size-2" />}
                        </div>
                        <span className="truncate">{child.name}</span>
                      </div>
                      {childFacetCount !== undefined && (
                        <span className="text-[10px] tabular-nums text-muted-foreground ml-2 shrink-0">
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
      <div className="flex flex-col gap-2 pt-4 border-t border-border">
        <h4 className="text-xs font-semibold text-foreground">Availability</h4>
        <label className="flex items-center gap-2 text-xs font-medium text-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={handleInStockToggle}
            className="size-4 rounded border-border text-primary focus:ring-primary"
          />
          <span>In Stock Only</span>
        </label>
      </div>

      {/* Price Range */}
      <div className="flex flex-col gap-3 pt-4 border-t border-border">
        <h4 className="text-xs font-semibold text-foreground">Price Range (BDT)</h4>
        <form onSubmit={handlePriceApply} className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              placeholder="Min"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
              className="h-8 text-xs tabular-nums"
              min={0}
            />
            <span className="text-muted-foreground text-xs">&ndash;</span>
            <Input
              type="number"
              placeholder="Max"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
              className="h-8 text-xs tabular-nums"
              min={0}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" className="h-7 text-xs">
            Apply Price
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 pr-6 border-r border-border">
        {FilterContent}
      </aside>

      {/* Mobile Trigger Button and Drawer */}
      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex items-center gap-1.5 h-9 text-xs">
              <Filter className="size-3.5" />
              <span>Filters</span>
              {hasActiveFilters && (
                <span className="size-2 rounded-full bg-[var(--saffron)]" />
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] p-6">
            <SheetHeader className="text-left border-b pb-4">
              <SheetTitle className="text-base font-semibold">Filter Products</SheetTitle>
            </SheetHeader>
            <div className="mt-6">{FilterContent}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
