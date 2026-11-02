"use client";

import * as React from "react";
import { ProductImage } from "@/components/ui/product-image";
import { cn } from "@/lib/utils";

interface ProductGalleryProps {
  title: string;
  featuredImageUrl: string;
  images?: string[] | null;
}

export function ProductGallery({
  title,
  featuredImageUrl,
  images = [],
}: ProductGalleryProps) {
  const allImages = React.useMemo(() => {
    const list: string[] = [];
    if (featuredImageUrl) list.push(featuredImageUrl);
    if (Array.isArray(images)) {
      images.forEach((img) => {
        if (img && !list.includes(img)) list.push(img);
      });
    }
    return list.length > 0 ? list : ["/placeholder.svg"];
  }, [featuredImageUrl, images]);

  const [selectedIndex, setSelectedIndex] = React.useState(0);
  const currentImage = allImages[selectedIndex] || allImages[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Main Viewport */}
      <div className="relative aspect-square w-full rounded-2xl border border-border bg-muted/30 overflow-hidden shadow-2xs">
        <ProductImage
          src={currentImage}
          alt={`${title} - View ${selectedIndex + 1}`}
          fill
          priority
          className="object-cover transition-all duration-300"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>

      {/* Thumbnail Bar */}
      {allImages.length > 1 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2 pt-1 scrollbar-none">
          {allImages.map((img, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={cn(
                  "relative size-16 shrink-0 rounded-lg border-2 bg-muted/40 overflow-hidden transition-all duration-200",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 scale-102"
                    : "border-border hover:border-foreground/40 opacity-70 hover:opacity-100"
                )}
                aria-label={`Select image ${idx + 1}`}
                aria-current={isSelected}
              >
                <ProductImage
                  src={img}
                  alt={`${title} thumbnail ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="64px"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
