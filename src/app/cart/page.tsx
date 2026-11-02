"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2, ArrowRight, ShoppingBag, ShieldCheck, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Empty } from "@/components/ui/empty";
import { ProductImage } from "@/components/ui/product-image";
import { useCart } from "@/context/cart-context";
import { formatCurrencyBDT } from "@/lib/utils";

const FREE_SHIPPING_THRESHOLD = 100;

export default function CartPage() {
  const router = useRouter();
  const { items, itemCount, subtotal, isMounted, updateQuantity, removeItem, clearCart } =
    useCart();

  if (!isMounted) {
    return (
      <div className="container mx-auto px-4 py-16 flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 flex justify-center">
        <Empty
          icon={<ShoppingBag className="size-8" />}
          title="Your Cart is Empty"
          description="You haven't added any items to your bag yet. Discover our latest collections and find everyday essentials."
          action={
            <Button asChild size="lg">
              <Link href="/products">
                Start Shopping
                <ArrowRight className="size-4 ml-1.5" />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const freeShippingProgress = Math.min(
    100,
    Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100)
  );
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex items-center justify-between pb-6 border-b border-border">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Shopping Cart</h1>
          <p className="text-xs text-muted-foreground mt-1">
            {itemCount} {itemCount === 1 ? "item" : "items"} currently in your bag
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium"
        >
          Clear entire cart
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-8">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-8 flex flex-col divide-y divide-border">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row gap-6 items-start justify-between"
            >
              <div className="flex gap-4 items-start flex-1 min-w-0">
                <div className="relative size-24 rounded-xl overflow-hidden bg-muted/40 shrink-0 border border-border">
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                </div>

                <div className="flex flex-col gap-1 min-w-0">
                  <Link
                    href={`/products/${item.slug}`}
                    className="font-semibold text-base text-foreground hover:underline line-clamp-2"
                  >
                    {item.title}
                  </Link>

                  {item.variantTitle && (
                    <span className="text-xs text-muted-foreground">
                      Option: <strong className="text-foreground">{item.variantTitle}</strong>
                    </span>
                  )}

                  {item.sku && (
                    <span className="text-[11px] font-mono text-muted-foreground">
                      SKU: {item.sku}
                    </span>
                  )}

                  <div className="text-sm font-bold text-foreground tabular-nums mt-2 sm:hidden">
                    {formatCurrencyBDT(item.price * item.quantity)}
                  </div>
                </div>
              </div>

              {/* Quantity Controls & Price */}
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                <div className="flex items-center border rounded-lg bg-card shadow-2xs">
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                    className="size-8 flex items-center justify-center hover:bg-muted text-foreground transition-colors"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-10 text-center text-xs font-semibold tabular-nums text-foreground">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                    className="size-8 flex items-center justify-center hover:bg-muted text-foreground transition-colors"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="hidden sm:block text-right min-w-[90px]">
                  <span className="text-base font-bold tabular-nums text-foreground">
                    {formatCurrencyBDT(item.price * item.quantity)}
                  </span>
                  {item.quantity > 1 && (
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {formatCurrencyBDT(item.price)} each
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removeItem(item.variantId)}
                  className="text-muted-foreground hover:text-destructive p-1.5 transition-colors"
                  aria-label="Remove item from cart"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Order Summary */}
        <div className="lg:col-span-4">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sticky top-24 flex flex-col gap-5">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Order Summary</h2>

            {/* Free Shipping Meter */}
            <div className="bg-muted/40 rounded-xl p-3.5 text-xs">
              <div className="flex justify-between font-medium text-foreground mb-1.5">
                <span>
                  {remainingForFreeShipping === 0 ? (
                    <span className="text-emerald-700 font-semibold">
                      Free shipping qualified!
                    </span>
                  ) : (
                    <span>
                      Add <strong>{formatCurrencyBDT(remainingForFreeShipping)}</strong> more for free delivery
                    </span>
                  )}
                </span>
                <span className="tabular-nums font-semibold">{freeShippingProgress}%</span>
              </div>
              <div className="h-2 w-full bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--saffron)] transition-all duration-300"
                  style={{ width: `${freeShippingProgress}%` }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2.5 text-sm pt-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatCurrencyBDT(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Delivery</span>
                <span className="text-xs text-muted-foreground">Calculated at checkout</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-baseline">
              <span className="text-base font-semibold text-foreground">Estimated Total</span>
              <span className="text-xl font-bold tabular-nums text-foreground">
                {formatCurrencyBDT(subtotal)}
              </span>
            </div>

            <Button
              onClick={() => router.push("/checkout")}
              size="lg"
              className="w-full h-12 text-sm font-semibold"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="size-4 ml-1.5" />
            </Button>

            <div className="flex flex-col gap-2 pt-2 text-xs text-muted-foreground border-t border-border">
              <div className="flex items-center gap-2">
                <Truck className="size-3.5 text-[var(--saffron)]" />
                <span>Nationwide delivery with active tracking</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-3.5 text-[var(--saffron)]" />
                <span>Safe & encrypted checkout guarantees</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
