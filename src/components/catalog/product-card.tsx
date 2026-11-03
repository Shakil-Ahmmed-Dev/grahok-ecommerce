"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/components/ui/product-image";
import { useCart } from "@/context/cart-context";
import { formatCurrencyBDT } from "@/lib/utils";
import type { TGetProductPublic } from "@/features/products/types";

interface ProductCardProps {
  product: TGetProductPublic;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();
  const [added, setAdded] = React.useState(false);

  // Find primary default variant or first variant
  const defaultVariant =
    product.variants?.find((v) => v.isDefault) || product.variants?.[0];

  const hasMultipleVariants = (product.variants?.length ?? 0) > 1;

  // Determine stock availability across standalone and variant/shared-pool models
  const effectiveStock =
    product.inventoryType === "shared_pool"
      ? (product.poolStock ?? 0)
      : (product.stock ?? defaultVariant?.stock ?? 0);

  const effectiveAllowBackorder =
    product.allowBackorder ?? defaultVariant?.allowBackorder ?? false;

  const isOutOfStock = effectiveStock <= 0 && !effectiveAllowBackorder;
  const isBackorder = effectiveStock <= 0 && effectiveAllowBackorder;

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!defaultVariant || isOutOfStock) return;

    addItem(
      {
        variantId: defaultVariant.id,
        productId: product.id,
        slug: product.slug,
        title: product.name,
        variantTitle: defaultVariant.title !== product.name ? defaultVariant.title : undefined,
        price: defaultVariant.sellPrice ?? product.sellPrice,
        imageUrl: defaultVariant.imageUrl || product.featuredImageUrl,
        sku: defaultVariant.sku,
        maxStock: defaultVariant.stock ?? product.stock,
        allowBackorder: defaultVariant.allowBackorder ?? product.allowBackorder,
      },
      1
    );

    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <div className="group relative flex flex-col rounded-xl border border-[var(--border)] bg-white overflow-hidden shadow-starbucks-card hover:shadow-md transition-all duration-200">
      {/* Image Viewport */}
      <Link
        href={`/products/${product.slug}`}
        className="relative aspect-square w-full overflow-hidden bg-[var(--brand-ceramic)] block"
      >
        <ProductImage
          src={product.featuredImageUrl}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />

        {/* Status Badge: Only rendered for actionable exceptions (Out of stock or Backorder) */}
        {isOutOfStock ? (
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="outOfStock" className="px-2.5 py-0.5 text-[10px] font-semibold">
              Out of Stock
            </Badge>
          </div>
        ) : isBackorder ? (
          <div className="absolute top-3 left-3 z-10">
            <Badge variant="backorder" className="px-2.5 py-0.5 text-[10px] font-semibold">
              Backorder
            </Badge>
          </div>
        ) : null}
      </Link>

      {/* Card Details */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Category Badge */}
        {product.categories?.[0] && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-green)] mb-1.5">
            {product.categories[0].name}
          </span>
        )}

        {/* Title */}
        <h3 className="text-sm font-semibold text-[rgba(0,0,0,0.87)] tracking-[-0.01em] line-clamp-2 hover:text-[var(--brand-accent)] transition-colors">
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h3>

        {/* Price & Action Row */}
        <div className="mt-auto pt-4 flex items-center justify-between gap-3">
          <div>
            <span className="text-base font-bold tabular-nums text-[rgba(0,0,0,0.87)]">
              {formatCurrencyBDT(product.sellPrice)}
            </span>
          </div>

          <div>
            {hasMultipleVariants ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 px-4 text-xs font-semibold"
              >
                <Link href={`/products/${product.slug}`}>Options</Link>
              </Button>
            ) : (
              <Button
                onClick={handleQuickAdd}
                disabled={isOutOfStock}
                variant={added ? "secondary" : "default"}
                size="sm"
                className="h-8 px-3.5 text-xs font-semibold"
                aria-label={`Add ${product.name} to bag`}
              >
                {added ? (
                  <>
                    <Check className="size-3.5 mr-1 text-[var(--brand-accent)]" />
                    <span>Added</span>
                  </>
                ) : (
                  <>
                    <Plus className="size-3.5 mr-1" />
                    <span>Add</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
