import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, RotateCcw, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Returns & Replacements Policy | Grahok",
  description:
    "Learn about Grahok's 7-day hassle-free replacement guarantee, return eligibility conditions, and refund procedures.",
};

export default function ReturnsPolicyPage() {
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 max-w-4xl">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-[rgba(0,0,0,0.58)] mb-8"
      >
        <Link href="/" className="hover:text-[var(--brand-accent)] transition-colors">
          Home
        </Link>
        <ChevronRight className="size-3 text-[rgba(0,0,0,0.4)]" />
        <span className="font-bold text-[var(--brand-green)]">Returns & Replacements</span>
      </nav>

      {/* Header Banner */}
      <div className="pb-8 mb-10 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)] mb-2">
          <RotateCcw className="size-4" />
          <span>Customer Assurance</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-green)]">
          7-Day Return & Replacement Policy
        </h1>
        <p className="text-sm text-[rgba(0,0,0,0.65)] mt-2 leading-relaxed">
          We want you to love everything you order from Grahok. If an item arrives damaged, defective,
          or does not match your expectations, we offer straightforward replacements and refunds.
        </p>
      </div>

      {/* 3 Pillars of Return Guarantee */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <RotateCcw className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">7 Days Window</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            Submit a return or exchange request within 7 calendar days of delivery confirmation.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <ShieldCheck className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">Complimentary Pickup</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            Free doorstep pickup by courier for any defective, damaged, or incorrect items.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <CheckCircle2 className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">Prompt Settlement</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            Replacement dispatch within 48 hours or full refund via bKash / Nagad / Bank transfer.
          </p>
        </div>
      </div>

      {/* Policy Details */}
      <div className="flex flex-col gap-8 text-sm text-[rgba(0,0,0,0.8)] leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">1. Return Eligibility Requirements</h2>
          <p>
            To qualify for a replacement or refund, items must fulfill the following criteria:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-xs text-[rgba(0,0,0,0.7)]">
            <li>
              The item must be in its original, unwashed, and unused condition with all original tags, accessories, and warranty cards attached.
            </li>
            <li>
              The product must be packed in the original manufacturer packaging with protective wraps.
            </li>
            <li>
              A valid proof of purchase (Order Reference number or SMS receipt) must be presented.
            </li>
            <li>
              For damaged goods, a clear photo or video demonstrating the defect upon arrival helps expedite approval.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">2. Step-by-Step Return Process</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-1">
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-xs">
              <span className="font-extrabold text-[var(--brand-accent)] text-sm block mb-1">01. Request</span>
              <p className="text-[rgba(0,0,0,0.65)]">
                Email concierge@grahok.com or call our helpline with your order number and issue details.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-xs">
              <span className="font-extrabold text-[var(--brand-accent)] text-sm block mb-1">02. Review</span>
              <p className="text-[rgba(0,0,0,0.65)]">
                Our support team validates eligibility within 24 hours and issues a return authorization.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-xs">
              <span className="font-extrabold text-[var(--brand-accent)] text-sm block mb-1">03. Doorstep Pickup</span>
              <p className="text-[rgba(0,0,0,0.65)]">
                Our courier rider collects the parcel straight from your shipping address.
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-xs">
              <span className="font-extrabold text-[var(--brand-accent)] text-sm block mb-1">04. Resolution</span>
              <p className="text-[rgba(0,0,0,0.65)]">
                Choose between instant replacement dispatch or full refund settlement.
              </p>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">3. Refund Processing & Payment Channels</h2>
          <p>
            Once our quality assurance team receives and verifies the returned product at our Dhaka hub:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[rgba(0,0,0,0.7)]">
            <li>
              <strong>Cash on Delivery (COD) Orders:</strong> Refunds are disbursed directly to your bKash, Nagad, Rocket, or designated Bangladeshi bank account within 3 to 5 business days.
            </li>
            <li>
              <strong>Card & Digital Gateway Transactions:</strong> Reversals are posted through SSLCOMMERZ / payment gateway back to the originating debit or credit card (subject to bank clearance cycles).
            </li>
            <li>
              <strong>Shipping Fee Refunds:</strong> If the return is due to our error (defective, wrong SKU, transit damage), the original shipping fee is completely refunded.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">4. Non-Returnable Goods</h2>
          <p>
            For safety, hygiene, and product integrity reasons, certain product classifications cannot be returned once opened:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[rgba(0,0,0,0.7)]">
            <li>Personal care, hygiene, or grooming products with unsealed packaging.</li>
            <li>Customized, tailored, or personalized artisanal merchandise.</li>
            <li>Items damaged due to customer misuse, drops, liquid immersion, or unauthorized repair attempts.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--brand-mint)]/40 bg-[var(--brand-cream)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
          <div>
            <h3 className="font-bold text-base text-[var(--brand-green)]">Need to Initiate a Return?</h3>
            <p className="text-xs text-[rgba(0,0,0,0.65)] mt-1">
              Contact our care team with your order reference number to begin.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button asChild size="sm">
              <a href="mailto:concierge@grahok.com">Email concierge@grahok.com</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/account/orders">View My Orders</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
