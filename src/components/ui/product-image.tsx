"use client";

import * as React from "react";
import Image, { type ImageProps } from "next/image";
import { Package } from "lucide-react";
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

  // If no src or error loading, show graceful placeholder
  if (!src || error) {
    return (
      <div
        className={cn(
          "flex size-full items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-zinc-400 select-none overflow-hidden",
          className
        )}
        aria-label={alt}
        role="img"
      >
        <Package className={cn("size-8 opacity-40", fallbackIconClassName)} />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
}
