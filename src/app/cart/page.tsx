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

// Offer condition / threshold to be managed in admin panel; keeping current value as requested
const FREE_SHIPPING_THRESHOLD = 100;

export default function CartPage() {
  const router = useRouter();
  const { items, itemCount, subtotal, isMounted, updateQuantity, removeItem, clearCart } =
    useCart();

  if (!isMounted) {
    return (
      <div className="container mx-auto px-4 py-20 flex items-center justify-center">
        <div className="size-8 rounded-full border-2 border-[var(--brand-accent)] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-24 flex justify-center">
        <Empty
          icon={<ShoppingBag className="size-10 text-[var(--brand-green)]" />}
          title="Your Shopping Bag is Empty"
          description="You haven't added any curated items yet. Discover our latest collections and find daily essentials."
          action={
            <Button asChild size="lg">
              <Link href="/products">
                <span>Start Shopping</span>
                <ArrowRight className="size-4 ml-2" />
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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
      <div className="flex items-center justify-between pb-6 border-b border-[var(--border)]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--brand-green)]">
            Shopping Bag
          </h1>
          <p className="text-xs text-[rgba(0,0,0,0.58)] mt-1">
            {itemCount} {itemCount === 1 ? "item" : "items"} currently reserved in your bag
          </p>
        </div>
        <button
          onClick={clearCart}
          className="text-xs text-[rgba(0,0,0,0.58)] hover:text-[var(--destructive)] transition-colors font-semibold cursor-pointer"
        >
          Clear entire bag
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-8">
        {/* Left Column: Cart Items List */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {items.map((item) => (
            <div
              key={item.variantId}
              className="p-5 sm:p-6 rounded-xl border border-[var(--border)] bg-white shadow-starbucks-card flex flex-col sm:flex-row gap-6 items-start justify-between"
            >
              <div className="flex gap-4 items-start flex-1 min-w-0">
                <div className="relative size-24 rounded-xl overflow-hidden bg-[var(--brand-ceramic)] shrink-0 border border-[var(--border)]">
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
                    className="font-bold text-base text-[rgba(0,0,0,0.87)] hover:text-[var(--brand-accent)] transition-colors line-clamp-2"
                  >
                    {item.title}
                  </Link>

                  {item.variantTitle && (
                    <span className="text-xs text-[rgba(0,0,0,0.58)]">
                      Option: <strong className="text-[rgba(0,0,0,0.87)]">{item.variantTitle}</strong>
                    </span>
                  )}

                  <div className="text-sm font-bold text-[var(--brand-green)] tabular-nums mt-2 sm:hidden">
                    {formatCurrencyBDT(item.price * item.quantity)}
                  </div>
                </div>
              </div>

              {/* Quantity Controls & Price */}
              <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                <div className="flex items-center border border-[var(--border)] rounded-full bg-white shadow-2xs p-0.5">
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                    className="size-7 rounded-full flex items-center justify-center hover:bg-[var(--brand-ceramic)] text-[var(--foreground)] transition-colors cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-9 text-center text-xs font-bold tabular-nums text-[var(--foreground)]">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                    className="size-7 rounded-full flex items-center justify-center hover:bg-[var(--brand-ceramic)] text-[var(--foreground)] transition-colors cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <div className="hidden sm:block text-right min-w-[100px]">
                  <span className="text-base font-bold tabular-nums text-[var(--brand-green)]">
                    {formatCurrencyBDT(item.price * item.quantity)}
                  </span>
                  {item.quantity > 1 && (
                    <div className="text-[11px] text-[rgba(0,0,0,0.58)] tabular-nums">
                      {formatCurrencyBDT(item.price)} each
                    </div>
                  )}
                </div>

                <button
                  onClick={() => removeItem(item.variantId)}
                  className="text-[rgba(0,0,0,0.4)] hover:text-[var(--destructive)] p-1.5 transition-colors cursor-pointer"
                  aria-label="Remove item from bag"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right Column: Order Summary Card */}
        <div className="lg:col-span-4">
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-starbucks-card sticky top-28 flex flex-col gap-5">
            <h2 className="text-lg font-bold tracking-tight text-[var(--brand-green)]">
              Order Summary
            </h2>

            {/* Free Shipping Meter */}
            <div className="bg-[var(--brand-ceramic)] rounded-xl p-3.5 text-xs">
              <div className="flex justify-between font-semibold text-[rgba(0,0,0,0.87)] mb-1.5">
                <span>
                  {remainingForFreeShipping === 0 ? (
                    <span className="text-[var(--brand-accent)] font-bold">
                      Free shipping qualified!
                    </span>
                  ) : (
                    <span>
                      Add <strong>{formatCurrencyBDT(remainingForFreeShipping)}</strong> more for free delivery
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

            <div className="flex flex-col gap-2.5 text-sm pt-2">
              <div className="flex justify-between">
                <span className="text-[rgba(0,0,0,0.58)]">Subtotal</span>
                <span className="font-bold tabular-nums text-[rgba(0,0,0,0.87)]">
                  {formatCurrencyBDT(subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgba(0,0,0,0.58)]">Estimated Delivery</span>
                <span className="text-xs text-[rgba(0,0,0,0.58)]">Calculated at checkout</span>
              </div>
            </div>

            <Separator />

            <div className="flex justify-between items-baseline">
              <span className="text-base font-bold text-[rgba(0,0,0,0.87)]">Estimated Total</span>
              <span className="text-2xl font-extrabold tabular-nums text-[var(--brand-green)]">
                {formatCurrencyBDT(subtotal)}
              </span>
            </div>

            <Button
              onClick={() => router.push("/checkout")}
              size="lg"
              className="w-full h-12 text-sm font-semibold"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="size-4 ml-2" />
            </Button>

            <div className="flex flex-col gap-2 pt-3 text-xs text-[rgba(0,0,0,0.65)] border-t border-[var(--border)]">
              <div className="flex items-center gap-2.5">
                <Truck className="size-3.5 text-[var(--brand-accent)]" />
                <span>Nationwide delivery with active tracking</span>
              </div>
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="size-3.5 text-[var(--brand-accent)]" />
                <span>Safe & encrypted checkout guarantees</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
