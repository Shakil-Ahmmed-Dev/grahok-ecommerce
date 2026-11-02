"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, ShoppingBag, Zap, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/context/cart-context";
import { formatCurrencyBDT } from "@/lib/utils";
import type { TGetProductPublic, TProductVariantPublic } from "@/features/products/types";

interface VariantSelectorProps {
  product: TGetProductPublic;
}

export function VariantSelector({ product }: VariantSelectorProps) {
  const router = useRouter();
  const { addItem } = useCart();

  // Find initial default variant
  const initialVariant =
    product.variants?.find((v) => v.isDefault) || product.variants?.[0];

  // Initialize selected options map
  const [selectedOptions, setSelectedOptions] = React.useState<Record<string, string>>(() => {
    if (initialVariant?.optionValues && typeof initialVariant.optionValues === "object") {
      return { ...(initialVariant.optionValues as Record<string, string>) };
    }
    const initial: Record<string, string> = {};
    product.options?.forEach((opt) => {
      if (opt.values && opt.values.length > 0) {
        initial[opt.name] = opt.values[0].value;
      }
    });
    return initial;
  });

  const [quantity, setQuantity] = React.useState(1);
  const [isAdding, setIsAdding] = React.useState(false);

  // Find active variant by matching all selected options
  const activeVariant: TProductVariantPublic | undefined = React.useMemo(() => {
    if (!product.variants || product.variants.length === 0) return undefined;
    return product.variants.find((v) => {
      if (!v.optionValues || typeof v.optionValues !== "object") return false;
      const vOpts = v.optionValues as Record<string, string>;
      return Object.entries(selectedOptions).every(
        ([optName, optVal]) => vOpts[optName] === optVal
      );
    }) || product.variants.find((v) => v.isDefault) || product.variants[0];
  }, [product.variants, selectedOptions]);

  // Pricing & inventory calculations
  const currentPrice = activeVariant?.sellPrice ?? product.sellPrice;
  const currentStock = activeVariant?.stock ?? product.stock;
  const allowBackorder = activeVariant?.allowBackorder ?? product.allowBackorder ?? false;
  const currentSku = activeVariant?.sku || product.slug;

  const isOutOfStock = currentStock !== null && currentStock <= 0 && !allowBackorder;
  const isBackorder = currentStock !== null && currentStock <= 0 && allowBackorder;

  // Handle option click
  const handleOptionChange = (optionName: string, value: string) => {
    setSelectedOptions((prev) => ({
      ...prev,
      [optionName]: value,
    }));
    setQuantity(1);
  };

  const handleQuantityChange = (delta: number) => {
    setQuantity((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (!allowBackorder && currentStock !== null && next > currentStock) {
        return currentStock;
      }
      return next;
    });
  };

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isOutOfStock) return;

    setIsAdding(true);
    addItem(
      {
        variantId: activeVariant?.id || product.id,
        productId: product.id,
        slug: product.slug,
        title: product.name,
        variantTitle: activeVariant?.title !== product.name ? activeVariant?.title : undefined,
        price: currentPrice,
        imageUrl: activeVariant?.imageUrl || product.featuredImageUrl,
        sku: currentSku,
        maxStock: currentStock,
        allowBackorder,
      },
      quantity
    );

    setTimeout(() => setIsAdding(false), 500);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    handleAddToCart();
    router.push("/checkout");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Price & Status Row */}
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-col gap-1">
          <div className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground tabular-nums">
            {formatCurrencyBDT(currentPrice)}
          </div>
          {currentSku && (
            <span className="text-xs font-mono text-muted-foreground uppercase">
              SKU: {currentSku}
            </span>
          )}
        </div>

        <div>
          {isOutOfStock ? (
            <Badge variant="outOfStock" className="px-3 py-1 text-xs">
              Out of Stock
            </Badge>
          ) : isBackorder ? (
            <Badge variant="backorder" className="px-3 py-1 text-xs font-medium">
              Available on Backorder
            </Badge>
          ) : (
            <Badge variant="inStock" className="px-3 py-1 text-xs">
              In Stock {currentStock !== null && `(${currentStock} available)`}
            </Badge>
          )}
        </div>
      </div>

      {isBackorder && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <strong>Backorder Note:</strong> This item is currently awaiting restock and will dispatch
          as soon as inventory arrives.
        </div>
      )}

      {/* Dynamic Option Selectors */}
      {product.options && product.options.length > 0 && (
        <div className="flex flex-col gap-5">
          {product.options.map((opt) => (
            <div key={opt.id} className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-foreground uppercase tracking-wider">
                  {opt.name}
                </span>
                <span className="text-muted-foreground font-medium">
                  {selectedOptions[opt.name] || "Select"}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {opt.values.map((val) => {
                  const isSelected = selectedOptions[opt.name] === val.value;
                  return (
                    <button
                      key={val.id}
                      type="button"
                      onClick={() => handleOptionChange(opt.name, val.value)}
                      className={`min-w-12 h-9 px-3.5 rounded-lg text-xs font-medium border transition-all duration-150 select-none ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-xs ring-2 ring-primary/20"
                          : "border-border bg-card text-foreground hover:bg-muted hover:border-foreground/40"
                      }`}
                    >
                      {val.value}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quantity & Actions */}
      <div className="flex flex-col gap-4 pt-2">
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Quantity
          </span>
          <div className="flex items-center border rounded-lg bg-card shadow-2xs">
            <button
              type="button"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1 || isOutOfStock}
              className="size-9 flex items-center justify-center hover:bg-muted text-foreground transition-colors disabled:opacity-40"
              aria-label="Decrease quantity"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-12 text-center text-sm font-semibold tabular-nums text-foreground">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => handleQuantityChange(1)}
              disabled={(!allowBackorder && currentStock !== null && quantity >= currentStock) || isOutOfStock}
              className="size-9 flex items-center justify-center hover:bg-muted text-foreground transition-colors disabled:opacity-40"
              aria-label="Increase quantity"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAdding}
            className="h-12 text-sm font-semibold shadow-sm"
          >
            <ShoppingBag className="size-4 mr-2" />
            <span>{isOutOfStock ? "Out of Stock" : "Add to Cart"}</span>
          </Button>

          <Button
            type="button"
            onClick={handleBuyNow}
            disabled={isOutOfStock}
            variant="saffron"
            className="h-12 text-sm font-semibold shadow-sm"
          >
            <Zap className="size-4 mr-1.5" />
            <span>Buy Now</span>
          </Button>
        </div>
      </div>

      {/* Value Trust Details */}
      <div className="rounded-xl border border-border bg-muted/30 p-4 mt-2 flex flex-col gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <Truck className="size-4 text-[var(--saffron)] shrink-0" />
          <span>Nationwide door delivery across all 64 districts</span>
        </div>
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="size-4 text-[var(--saffron)] shrink-0" />
          <span>100% Genuine product & encrypted checkout</span>
        </div>
        <div className="flex items-center gap-2.5">
          <RotateCcw className="size-4 text-[var(--saffron)] shrink-0" />
          <span>7-day simple replacement guarantee</span>
        </div>
      </div>

      {/* Sticky Mobile Purchase Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 p-3 backdrop-blur-md sm:hidden flex items-center justify-between gap-3 shadow-lg">
        <div className="flex flex-col min-w-0">
          <span className="text-xs text-muted-foreground truncate">{product.name}</span>
          <span className="text-base font-bold tabular-nums text-foreground">
            {formatCurrencyBDT(currentPrice)}
          </span>
        </div>
        <Button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          size="sm"
          className="h-10 px-5 text-xs font-semibold shrink-0"
        >
          <ShoppingBag className="size-3.5 mr-1.5" />
          <span>{isOutOfStock ? "Sold Out" : "Add to Cart"}</span>
        </Button>
      </div>
    </div>
  );
}
