"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ProductImage } from "@/components/ui/product-image";
import { useCart } from "@/context/cart-context";
import { formatCurrencyBDT } from "@/lib/utils";

// Offer condition / threshold to be managed in admin panel; keeping current value as requested
const FREE_SHIPPING_THRESHOLD = 100;

export function CartSheet() {
  const { items, itemCount, subtotal, isOpen, closeCart, updateQuantity, removeItem } =
    useCart();
  const router = useRouter();

  const freeShippingProgress = Math.min(
    100,
    Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100)
  );
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  const handleCheckout = () => {
    closeCart();
    router.push("/checkout");
  };

  const handleViewCart = () => {
    closeCart();
    router.push("/cart");
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && closeCart()}>
      <SheetContent
        side="right"
        className="flex flex-col w-full sm:max-w-md p-0 gap-0 bg-[var(--brand-cream)]"
      >
        <SheetHeader className="p-6 border-b border-[var(--border)] bg-white text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold tracking-tight text-[var(--brand-green)] flex items-center gap-2">
              <ShoppingBag className="size-5 text-[var(--brand-accent)]" />
              <span>Your Shopping Bag</span>
              <span className="text-xs font-semibold text-[rgba(0,0,0,0.58)] ml-1">
                ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
            </SheetTitle>
          </div>

          {/* Free Shipping Meter */}
          <div className="mt-4 bg-[var(--brand-ceramic)] rounded-xl p-3 text-xs">
            <div className="flex justify-between font-semibold text-[rgba(0,0,0,0.87)] mb-1.5">
              <span>
                {remainingForFreeShipping === 0 ? (
                  <span className="text-[var(--brand-accent)] font-bold">
                    Free shipping qualified!
                  </span>
                ) : (
                  <span>
                    Add{" "}
                    <strong className="text-[var(--brand-green)] font-bold">
                      {formatCurrencyBDT(remainingForFreeShipping)}
                    </strong>{" "}
                    more for free delivery
                  </span>
                )}
              </span>
              <span className="tabular-nums font-bold text-[var(--brand-green)]">{freeShippingProgress}%</span>
            </div>
            <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-black/5">
              <div
                className="h-full bg-[var(--brand-accent)] transition-all duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>
        </SheetHeader>

        {/* Content / Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {items.length === 0 ? (
            <Empty
              icon={<ShoppingBag className="size-8 text-[var(--brand-green)]" />}
              title="Your bag is empty"
              description="Explore our curated departments to discover handcrafted essentials and daily utilities."
              action={
                <Button
                  onClick={() => {
                    closeCart();
                    router.push("/products");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Explore Catalog
                </Button>
              }
              className="border-none p-0 min-h-[300px]"
            />
          ) : (
            items.map((item) => (
              <div
                key={item.variantId}
                className="p-4 rounded-xl border border-[var(--border)] bg-white shadow-starbucks-card flex gap-4 items-start"
              >
                <div className="relative size-18 rounded-lg overflow-hidden bg-[var(--brand-ceramic)] shrink-0 border border-[var(--border)]">
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="72px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={closeCart}
                      className="font-bold text-sm text-[rgba(0,0,0,0.87)] hover:text-[var(--brand-accent)] transition-colors line-clamp-1"
                    >
                      {item.title}
                    </Link>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      aria-label="Remove item"
                      className="text-[rgba(0,0,0,0.4)] hover:text-[var(--destructive)] transition-colors p-0.5 cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {item.variantTitle && (
                    <p className="text-xs text-[rgba(0,0,0,0.58)] mt-0.5 line-clamp-1">
                      {item.variantTitle}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-[var(--border)]/60">
                    <div className="flex items-center border border-[var(--border)] rounded-full bg-white shadow-2xs p-0.5">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="size-6 rounded-full flex items-center justify-center hover:bg-[var(--brand-ceramic)] text-[var(--foreground)] transition-colors disabled:opacity-30 cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-7 text-center text-xs font-bold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="size-6 rounded-full flex items-center justify-center hover:bg-[var(--brand-ceramic)] text-[var(--foreground)] transition-colors disabled:opacity-30 cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>

                    <span className="text-sm font-extrabold text-[var(--brand-green)] tabular-nums">
                      {formatCurrencyBDT(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="p-6 border-t border-[var(--border)] bg-white flex flex-col gap-3 shadow-lg">
            <div className="flex justify-between items-center text-sm">
              <span className="text-[rgba(0,0,0,0.58)] font-medium">Estimated Subtotal</span>
              <span className="text-lg font-extrabold tabular-nums text-[var(--brand-green)]">
                {formatCurrencyBDT(subtotal)}
              </span>
            </div>
            <p className="text-xs text-[rgba(0,0,0,0.58)]">
              Taxes and doorstep delivery calculated during checkout.
            </p>

            <div className="flex flex-col gap-2.5 mt-2">
              <Button
                onClick={handleCheckout}
                size="lg"
                className="w-full h-12 text-sm font-semibold"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="size-4 ml-2" />
              </Button>
              <Button
                onClick={handleViewCart}
                variant="outline"
                size="sm"
                className="w-full text-xs font-semibold"
              >
                View Full Bag Details
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
