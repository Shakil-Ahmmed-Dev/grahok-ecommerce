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
    <div className="group relative flex flex-col rounded-xl border border-border bg-card overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200">
      {/* Image Viewport */}
      <Link
        href={`/products/${product.slug}`}
        className="relative aspect-square w-full overflow-hidden bg-muted/40 block"
      >
        <ProductImage
          src={product.featuredImageUrl}
          alt={product.name}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />

        {/* Status Badge */}
        <div className="absolute top-2.5 left-2.5 z-10">
          {isOutOfStock ? (
            <Badge variant="outOfStock" className="text-[10px] px-2 py-0.5">
              Out of Stock
            </Badge>
          ) : isBackorder ? (
            <Badge variant="backorder" className="text-[10px] px-2 py-0.5">
              Backorder
            </Badge>
          ) : (
            <Badge variant="inStock" className="text-[10px] px-2 py-0.5">
              In Stock
            </Badge>
          )}
        </div>
      </Link>

      {/* Card Details */}
      <div className="flex flex-1 flex-col p-4">
        {/* Category info */}
        {product.categories?.[0] && (
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            {product.categories[0].name}
          </span>
        )}

        {/* Title */}
        <h3 className="text-sm font-semibold text-foreground line-clamp-2 hover:underline">
          <Link href={`/products/${product.slug}`}>{product.name}</Link>
        </h3>

        {/* Price & Action Row */}
        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          <div>
            <span className="text-base font-bold tabular-nums text-foreground">
              {formatCurrencyBDT(product.sellPrice)}
            </span>
          </div>

          <div>
            {hasMultipleVariants ? (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium"
              >
                <Link href={`/products/${product.slug}`}>Options</Link>
              </Button>
            ) : (
              <Button
                onClick={handleQuickAdd}
                disabled={isOutOfStock}
                variant={added ? "secondary" : "default"}
                size="sm"
                className="h-8 px-3 text-xs font-medium"
                aria-label={`Add ${product.name} to cart`}
              >
                {added ? (
                  <>
                    <Check className="size-3.5 mr-1 text-emerald-600" />
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
