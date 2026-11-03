"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";
import { ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductImageProps extends Omit<ImageProps, "src"> {
  src?: string | null;
  alt: string;
  fallbackIconClassName?: string;
}

export function ProductImage({
  src,
  alt,
  className,
  fallbackIconClassName,
  ...props
}: ProductImageProps) {
  const [error, setError] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);

  // If no src or error loading, show warm curated retail placeholder
  if (!src || error) {
    return (
      <div
        className={cn(
          "flex size-full flex-col items-center justify-center bg-[var(--brand-ceramic)] text-[var(--foreground-soft)] select-none overflow-hidden relative group/fallback p-4",
          className
        )}
        aria-label={alt}
        role="img"
      >
        <div className="flex size-14 items-center justify-center rounded-full bg-white/70 shadow-2xs border border-black/5 text-[var(--brand-green)] mb-2">
          <ShoppingBag className={cn("size-6 opacity-70", fallbackIconClassName)} />
        </div>
        <span className="text-[10px] font-semibold tracking-wider uppercase text-[var(--brand-green)] opacity-70 text-center line-clamp-1 max-w-[85%]">
          {alt}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={cn(
        "transition-opacity duration-300 ease-in",
        loaded ? "opacity-100" : "opacity-0",
        className
      )}
      onLoad={() => setLoaded(true)}
      onError={() => setError(true)}
      {...props}
    />
  );
}
