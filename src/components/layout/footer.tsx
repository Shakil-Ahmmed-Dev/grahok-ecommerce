import * as React from "react";
import Link from "next/link";
import { ShieldCheck, Truck, RotateCcw, Headphones, ArrowUpRight } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-auto bg-[var(--brand-house)] text-white">
      {/* Consolidated Flagship Value Strip */}
      <div className="border-b border-white/10 py-10">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                <Truck className="size-5 text-[var(--brand-mint)]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">Nationwide Delivery</h4>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Carefully packed doorstep fulfillment across all 64 districts.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                <ShieldCheck className="size-5 text-[var(--brand-mint)]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">Verified Authenticity</h4>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Every item is curated and inspected before leaving our facility.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                <RotateCcw className="size-5 text-[var(--brand-mint)]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">7-Day Return Assurance</h4>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Hassle-free replacements and returns for complete peace of mind.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white">
                <Headphones className="size-5 text-[var(--brand-mint)]" />
              </div>
              <div>
                <h4 className="font-semibold text-sm text-white">Concierge Support</h4>
                <p className="text-xs text-white/70 mt-1 leading-relaxed">
                  Our dedicated customer care team is available daily for orders and advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Footer Directory */}
      <div className="container mx-auto px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
          {/* Brand Column */}
          <div className="md:col-span-4 flex flex-col gap-4">
            <Link href="/" className="inline-flex items-center gap-1 group">
              <span className="font-extrabold text-2xl tracking-tighter text-white">
                GRAHOK
              </span>
            </Link>
            <p className="text-xs text-white/70 leading-relaxed max-w-sm">
              Grahok is a curated modern retail flagship celebrating durable everyday utilities,
              tactile textiles, and artisanal living. Designed with care for modern living.
            </p>
            <div className="mt-2 text-xs text-white/80">
              <span className="text-white/60">Help Desk: </span>
              <a
                href="tel:+8801700000000"
                className="font-semibold text-white hover:text-[var(--brand-mint)] transition-colors tabular-nums"
              >
                +880 1700 000000
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-gold)] mb-4">
              Shop & Explore
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-white/70">
              <li>
                <Link href="/products" className="hover:text-white transition-colors">
                  Full Catalog
                </Link>
              </li>
              <li>
                <Link href="/products?sortBy=publishedAt&sortOrder=desc" className="hover:text-white transition-colors">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href="/products?inStock=true" className="hover:text-white transition-colors">
                  In-Stock Collections
                </Link>
              </li>
              <li>
                <Link href="/cart" className="hover:text-white transition-colors">
                  Shopping Bag
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="md:col-span-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-gold)] mb-4">
              Customer Experience
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-white/70">
              <li>
                <Link href="/account" className="hover:text-white transition-colors">
                  Account Overview
                </Link>
              </li>
              <li>
                <Link href="/account/orders" className="hover:text-white transition-colors">
                  Order History & Tracking
                </Link>
              </li>
              <li>
                <Link href="/account/addresses" className="hover:text-white transition-colors">
                  Saved Address Book
                </Link>
              </li>
              <li>
                <a href="mailto:concierge@grahok.com" className="hover:text-white transition-colors">
                  concierge@grahok.com
                </a>
              </li>
            </ul>
          </div>

          {/* Trust & Policies */}
          <div className="md:col-span-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--brand-gold)] mb-4">
              Assurance
            </h4>
            <ul className="flex flex-col gap-2.5 text-xs text-white/70">
              <li>
                <Link href="/account/privacy" className="hover:text-white transition-colors flex items-center gap-1">
                  <span>Privacy Policy</span>
                  <ArrowUpRight className="size-3 text-white/40" />
                </Link>
              </li>
              <li>
                <span className="text-white/80">Encrypted 256-bit Checkout</span>
              </li>
              <li>
                <span className="text-white/80">Cash on Delivery Available</span>
              </li>
              <li>
                <span className="text-white/80">Quality Guaranteed</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Bottom Bar */}
        <div className="mt-14 border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60">
          <p>&copy; {new Date().getFullYear()} Grahok. All rights reserved.</p>
          <div className="flex items-center gap-4 text-white/60">
            <span>Verified Secure Storefront</span>
            <span>&middot;</span>
            <span>Bangladesh</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
