import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata = {
  title: "Secure Checkout",
};

export default function CheckoutPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex items-center justify-between pb-6 border-b border-[var(--border)] mb-10">
        <div>
          <Link
            href="/cart"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[rgba(0,0,0,0.58)] hover:text-[var(--brand-accent)] transition-colors mb-2.5"
          >
            <ChevronLeft className="size-3.5" />
            <span>Return to Shopping Bag</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--brand-green)]">
            Complete Your Order
          </h1>
        </div>
      </div>

      <CheckoutForm />
    </div>
  );
}
