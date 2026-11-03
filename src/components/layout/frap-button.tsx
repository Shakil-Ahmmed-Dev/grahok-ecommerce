"use client";

import * as React from "react";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { usePathname } from "next/navigation";

export function FrapButton() {
  const { itemCount, openCart, isMounted } = useCart();
  const pathname = usePathname();

  // Don't render inside checkout to avoid distraction
  if (pathname === "/checkout") return null;

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={`Shopping bag with ${itemCount} items`}
      className="fixed bottom-6 right-6 z-40 flex size-14 items-center justify-center rounded-full bg-[var(--brand-accent)] text-white shadow-starbucks-frap transition-all duration-200 ease-out active:scale-[0.95] hover:bg-[#006540] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--brand-accent)]/30 cursor-pointer"
    >
      <ShoppingBag className="size-6 text-white" />
      {isMounted && itemCount > 0 && (
        <span className="absolute -top-1 -right-1 flex min-w-5 h-5 items-center justify-center rounded-full bg-[var(--brand-gold)] px-1.5 text-[11px] font-bold text-white tabular-nums shadow-sm animate-in zoom-in-75">
          {itemCount}
        </span>
      )}
    </button>
  );
}
