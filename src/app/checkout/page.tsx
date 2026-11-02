import Link from "next/link";
import { ChevronLeft, Lock } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata = {
  title: "Secure Checkout",
};

export default function CheckoutPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex items-center justify-between pb-6 border-b border-border mb-8">
        <div>
          <Link
            href="/cart"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ChevronLeft className="size-3.5" />
            <span>Return to Shopping Cart</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Complete Your Order
          </h1>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full border border-border">
          <Lock className="size-3.5 text-emerald-600" />
          <span>Encrypted 256-bit Checkout</span>
        </div>
      </div>

      <CheckoutForm />
    </div>
  );
}
