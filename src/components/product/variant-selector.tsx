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
  const { addItem, openCart } = useCart();

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

  const getCartItemData = () => ({
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
  });

  const handleAddToCart = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (isOutOfStock) return;

    setIsAdding(true);
    addItem(getCartItemData(), quantity);
    openCart();

    setTimeout(() => setIsAdding(false), 500);
  };

  const handleBuyNow = () => {
    if (isOutOfStock) return;
    addItem(getCartItemData(), quantity);
    router.push("/checkout");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Price & Status Row */}
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] pb-6">
        <div className="flex flex-col gap-1">
          <div className="text-3xl sm:text-4xl font-extrabold tracking-[-0.01em] text-[var(--brand-green)] tabular-nums">
            {formatCurrencyBDT(currentPrice)}
          </div>
        </div>

        <div>
          {isOutOfStock ? (
            <Badge variant="outOfStock" className="px-3 py-1 text-xs font-semibold">
              Out of Stock
            </Badge>
          ) : isBackorder ? (
            <Badge variant="backorder" className="px-3 py-1 text-xs font-semibold">
              Available on Backorder
            </Badge>
          ) : (
            <Badge variant="inStock" className="px-3 py-1 text-xs font-semibold">
              In Stock {currentStock !== null && `(${currentStock} ready)`}
            </Badge>
          )}
        </div>
      </div>

      {isBackorder && (
        <div className="rounded-xl border border-[var(--brand-gold-light)] bg-[var(--brand-gold-lightest)] p-3.5 text-xs text-[var(--foreground)]">
          <strong className="text-[var(--brand-gold)] font-bold">Backorder Note:</strong> This item is currently in handcrafted small batches and will dispatch as soon as the next run finishes.
        </div>
      )}

      {/* Dynamic Option Selectors (Pill geometry .agents/DESIGN.md) */}
      {product.options && product.options.length > 0 && (
        <div className="flex flex-col gap-5">
          {product.options.map((opt) => (
            <div key={opt.id} className="flex flex-col gap-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold uppercase tracking-wider text-[var(--brand-green)]">
                  {opt.name}
                </span>
                <span className="text-[rgba(0,0,0,0.58)] font-medium">
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
                      className={`min-w-14 h-9 px-4 rounded-full text-xs font-semibold border transition-all duration-150 select-none cursor-pointer active:scale-95 ${
                        isSelected
                          ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white shadow-2xs"
                          : "border-[var(--border)] bg-white text-[rgba(0,0,0,0.87)] hover:border-[var(--brand-accent)]"
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
      <div className="flex flex-col gap-5 pt-2">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-green)]">
            Quantity
          </span>
          {/* Numeric Stepper (.agents/DESIGN.md Section 4) */}
          <div className="flex items-center border border-[var(--border)] rounded-full bg-white shadow-2xs p-0.5">
            <button
              type="button"
              onClick={() => handleQuantityChange(-1)}
              disabled={quantity <= 1 || isOutOfStock}
              className="size-8 rounded-full flex items-center justify-center hover:bg-[var(--brand-ceramic)] text-[var(--foreground)] transition-colors disabled:opacity-30 cursor-pointer"
              aria-label="Decrease quantity"
            >
              <Minus className="size-3.5" />
            </button>
            <span className="w-10 text-center text-sm font-bold tabular-nums text-[var(--foreground)]">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => handleQuantityChange(1)}
              disabled={(!allowBackorder && currentStock !== null && quantity >= currentStock) || isOutOfStock}
              className="size-8 rounded-full flex items-center justify-center hover:bg-[var(--brand-ceramic)] text-[var(--foreground)] transition-colors disabled:opacity-30 cursor-pointer"
              aria-label="Increase quantity"
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons: 50px pill buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <Button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock || isAdding}
            size="lg"
            className="h-12 text-sm font-semibold shadow-xs"
          >
            <ShoppingBag className="size-4 mr-2" />
            <span>{isOutOfStock ? "Out of Stock" : "Add to Bag"}</span>
          </Button>

          <Button
            type="button"
            onClick={handleBuyNow}
            disabled={isOutOfStock}
            variant="dark"
            size="lg"
            className="h-12 text-sm font-semibold shadow-xs"
          >
            <Zap className="size-4 mr-1.5" />
            <span>Instant Checkout</span>
          </Button>
        </div>
      </div>

      {/* Value Trust Details Card */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-4.5 mt-2 flex flex-col gap-3 text-xs text-[rgba(0,0,0,0.65)] shadow-starbucks-card">
        <div className="flex items-center gap-3">
          <Truck className="size-4 text-[var(--brand-accent)] shrink-0" />
          <span>Nationwide door delivery across all 64 districts</span>
        </div>
        <div className="flex items-center gap-3">
          <ShieldCheck className="size-4 text-[var(--brand-accent)] shrink-0" />
          <span>100% Genuine product & encrypted checkout</span>
        </div>
        <div className="flex items-center gap-3">
          <RotateCcw className="size-4 text-[var(--brand-accent)] shrink-0" />
          <span>7-day simple replacement guarantee</span>
        </div>
      </div>
    </div>
  );
}
