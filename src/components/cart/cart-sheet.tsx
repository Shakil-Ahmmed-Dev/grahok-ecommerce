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
        className="flex flex-col w-full sm:max-w-md p-0 gap-0"
      >
        <SheetHeader className="p-6 border-b text-left">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold flex items-center gap-2">
              <ShoppingBag className="size-5 text-primary" />
              <span>Your Cart</span>
              <span className="text-xs font-normal text-muted-foreground ml-1">
                ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
            </SheetTitle>
          </div>

          {/* Free Shipping Meter */}
          <div className="mt-3 bg-muted/60 rounded-lg p-3 text-xs">
            <div className="flex justify-between font-medium text-foreground mb-1.5">
              <span>
                {remainingForFreeShipping === 0 ? (
                  <span className="text-emerald-700 font-semibold">
                    Free shipping unlocked!
                  </span>
                ) : (
                  <span>
                    Add{" "}
                    <strong className="text-foreground">
                      {formatCurrencyBDT(remainingForFreeShipping)}
                    </strong>{" "}
                    more for free shipping
                  </span>
                )}
              </span>
              <span className="tabular-nums font-semibold">{freeShippingProgress}%</span>
            </div>
            <div className="h-1.5 w-full bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--saffron)] transition-all duration-300"
                style={{ width: `${freeShippingProgress}%` }}
              />
            </div>
          </div>
        </SheetHeader>

        {/* Content / Items */}
        <div className="flex-1 overflow-y-auto p-6 divide-y divide-border">
          {items.length === 0 ? (
            <Empty
              icon={<ShoppingBag className="size-6" />}
              title="Your cart is empty"
              description="Looks like you haven't added anything yet. Explore our curated collections to find your essentials."
              action={
                <Button
                  onClick={() => {
                    closeCart();
                    router.push("/products");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Explore Products
                </Button>
              }
              className="border-none p-0 min-h-[300px]"
            />
          ) : (
            items.map((item) => (
              <div
                key={item.variantId}
                className="py-4 first:pt-0 last:pb-0 flex gap-4 items-start"
              >
                <div className="relative size-18 rounded-md overflow-hidden bg-muted shrink-0 border">
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
                      className="font-medium text-sm text-foreground hover:underline line-clamp-1"
                    >
                      {item.title}
                    </Link>
                    <button
                      onClick={() => removeItem(item.variantId)}
                      aria-label="Remove item"
                      className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>

                  {item.variantTitle && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {item.variantTitle}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border rounded-md">
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                        className="size-7 flex items-center justify-center hover:bg-muted text-foreground transition-colors disabled:opacity-40"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="size-3" />
                      </button>
                      <span className="w-8 text-center text-xs font-semibold tabular-nums">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                        className="size-7 flex items-center justify-center hover:bg-muted text-foreground transition-colors disabled:opacity-40"
                        aria-label="Increase quantity"
                      >
                        <Plus className="size-3" />
                      </button>
                    </div>

                    <span className="text-sm font-semibold text-foreground tabular-nums">
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
          <div className="p-6 border-t bg-muted/20 flex flex-col gap-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-base font-semibold tabular-nums text-foreground">
                {formatCurrencyBDT(subtotal)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Taxes and delivery calculated during checkout.
            </p>

            <div className="flex flex-col gap-2 mt-2">
              <Button
                onClick={handleCheckout}
                className="w-full h-11 text-base font-medium"
              >
                Proceed to Checkout
                <ArrowRight className="size-4 ml-1" />
              </Button>
              <Button
                onClick={handleViewCart}
                variant="outline"
                className="w-full text-xs"
              >
                View Full Cart
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
