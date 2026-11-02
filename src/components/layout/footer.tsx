import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Truck, RotateCcw, Lock } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      {/* Commerce Value Propositions */}
      <div className="border-b border-border bg-muted/30">
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2.5 border shadow-2xs">
                <Truck className="size-5 text-[var(--saffron)]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Nationwide Delivery
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Fast doorstep delivery across all 64 districts in Bangladesh.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2.5 border shadow-2xs">
                <Lock className="size-5 text-[var(--saffron)]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Secure Checkout
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  100% encrypted checkout with purchase protection.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2.5 border shadow-2xs">
                <ShieldCheck className="size-5 text-[var(--saffron)]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  Verified Genuine
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Authentic, quality-checked goods crafted for everyday living.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-background p-2.5 border shadow-2xs">
                <RotateCcw className="size-5 text-[var(--saffron)]" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  7-Day Easy Returns
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Simple, stress-free return process for full peace of mind.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          <div className="md:col-span-1">
            <Link href="/" className="inline-flex items-center gap-1 group">
              <span className="font-bold text-2xl tracking-tighter text-foreground">
                GRAHOK
              </span>
              <span className="size-2 rounded-full bg-[var(--saffron)]" />
            </Link>
            <p className="mt-3 text-xs text-muted-foreground leading-relaxed max-w-sm">
              Grahok is a curated modern commerce destination celebrating
              thoughtful craftsmanship, utilitarian beauty, and reliable
              doorstep service.
            </p>
            <div className="mt-4 text-xs text-muted-foreground">
              <span>Customer Care: </span>
              <span className="font-medium text-foreground tabular-nums">
                <a
                  href="tel:+8801700000000"
                  className="hover:text-foreground transition-colors"
                >
                  +880 1700 000000
                </a>
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
              Shop & Explore
            </h4>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link
                  href="/products"
                  className="hover:text-foreground transition-colors"
                >
                  All Products
                </Link>
              </li>
              <li>
                <Link
                  href="/products?sortBy=publishedAt&sortOrder=desc"
                  className="hover:text-foreground transition-colors"
                >
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link
                  href="/products?inStock=true"
                  className="hover:text-foreground transition-colors"
                >
                  In-Stock Items
                </Link>
              </li>
              <li>
                <Link
                  href="/cart"
                  className="hover:text-foreground transition-colors"
                >
                  Shopping Cart
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
              Customer Support
            </h4>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <Link
                  href="/account"
                  className="hover:text-foreground transition-colors"
                >
                  Your Account
                </Link>
              </li>
              <li>
                <Link
                  href="/account/orders"
                  className="hover:text-foreground transition-colors"
                >
                  Order History & Tracking
                </Link>
              </li>
              <li>
                <Link
                  href="/account/addresses"
                  className="hover:text-foreground transition-colors"
                >
                  Address Book
                </Link>
              </li>
              <li>
                <span className="text-muted-foreground/80">
                  Support:{" "}
                  <a
                    href="mailto:support@grahok.com"
                    className="hover:text-foreground transition-colors"
                  >
                    support@grahok.com
                  </a>
                </span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-foreground mb-3">
              Legal & Trust
            </h4>
            <ul className="flex flex-col gap-2 text-xs text-muted-foreground">
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Terms of Service
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Privacy Policy
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Return & Refund Policy
                </span>
              </li>
              <li>
                <span className="hover:text-foreground transition-colors cursor-pointer">
                  Shipping & Logistics Information
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()} Grahok Commerce. All rights
            reserved.
          </p>
          <div className="flex items-center gap-4">
            <span>
              Created by{" "}
              <a
                href="https://www.github.com/Shakil-Ahmmed-Dev"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors"
              >
                SAW Dev
              </a>
            </span>
            <span>&middot;</span>
            <span>Khulna, Bangladesh</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
