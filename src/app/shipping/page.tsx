import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Truck, Clock, ShieldCheck, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | Grahok",
  description:
    "Learn about Grahok's nationwide delivery coverage across all 64 districts in Bangladesh, rates, and dispatch timelines.",
};

export default function ShippingPolicyPage() {
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
        <span className="font-bold text-[var(--brand-green)]">Shipping Policy</span>
      </nav>

      {/* Header Banner */}
      <div className="pb-8 mb-10 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)] mb-2">
          <Truck className="size-4" />
          <span>Nationwide Logistics</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-green)]">
          Shipping & Delivery Policy
        </h1>
        <p className="text-sm text-[rgba(0,0,0,0.65)] mt-2 leading-relaxed">
          Transparent rates, reliable delivery timelines, and dedicated courier fulfillment across
          all 64 districts in Bangladesh.
        </p>
      </div>

      {/* Policy Key Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <Clock className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">24–48 Hours</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            Swift delivery within Dhaka Metropolitan area following order confirmation.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <MapPin className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">All 64 Districts</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            Direct doorstep courier fulfillment to divisional cities, upazilas, and unions nationwide.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <ShieldCheck className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">Free Over ৳100</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            Complimentary shipping applied automatically on all qualifying orders exceeding ৳100.
          </p>
        </div>
      </div>

      {/* Detailed Policy Sections */}
      <div className="flex flex-col gap-8 text-sm text-[rgba(0,0,0,0.8)] leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">1. Delivery Zones & Estimated Timelines</h2>
          <p>
            Orders placed on Grahok are packed with protective eco-friendly cushioning and dispatched
            from our central fulfillment facility in Dhaka. Estimated delivery windows:
          </p>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white shadow-2xs mt-1">
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--brand-cream)] text-[var(--brand-green)] font-bold border-b border-[var(--border)]">
                <tr>
                  <th className="py-3 px-4">Delivery Zone</th>
                  <th className="py-3 px-4">Estimated Transit Window</th>
                  <th className="py-3 px-4">Courier Service</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                <tr>
                  <td className="py-3 px-4 font-semibold">Dhaka Metro Area</td>
                  <td className="py-3 px-4">24 to 48 hours</td>
                  <td className="py-3 px-4">Dedicated Express Courier</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold">Greater Dhaka (Savar, Gazipur, Narayanganj)</td>
                  <td className="py-3 px-4">48 to 72 hours</td>
                  <td className="py-3 px-4">Regional Courier Network</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold">Divisional Hubs (Chittagong, Sylhet, Rajshahi, Khulna, etc.)</td>
                  <td className="py-3 px-4">2 to 4 business days</td>
                  <td className="py-3 px-4">Nationwide Priority Surface</td>
                </tr>
                <tr>
                  <td className="py-3 px-4 font-semibold">Other Districts & Upazila Levels</td>
                  <td className="py-3 px-4">3 to 5 business days</td>
                  <td className="py-3 px-4">Standard Doorstep Delivery</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">2. Shipping Charges & Free Delivery Threshold</h2>
          <p>
            We believe in honest, predictable pricing with zero hidden surcharges:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[rgba(0,0,0,0.7)]">
            <li>
              <strong>Complimentary Shipping:</strong> Automatically applied to all shopping bags with a subtotal of <strong>৳100.00</strong> or higher.
            </li>
            <li>
              <strong>Standard Base Rate:</strong> A flat base rate of <strong>৳10.00</strong> applies to standard parcels under the threshold.
            </li>
            <li>
              <strong>Heavy Freight:</strong> For bulk or high-weight artisanal utilities, a nominal <strong>৳2.00 per kilogram</strong> weight charge is calculated transparently during live checkout estimation.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">3. Real-Time Tracking & Verification</h2>
          <p>
            Every order generates an immutable order reference number. You will receive an SMS update
            when your package is handed over to the courier partner. You can track your parcel&apos;s progress
            at any time through our <Link href="/account/orders" className="text-[var(--brand-accent)] font-semibold underline">Order Tracking Portal</Link> using your verified order number and registered phone number or access token.
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">4. Doorstep Inspection & Cash on Delivery (COD)</h2>
          <p>
            When choosing Cash on Delivery, our courier representative will arrive at your address with the sealed package. We encourage you to inspect the exterior tamper-evident seal before completing payment. In the rare event of transit damage, notify the rider immediately or contact our concierge desk.
          </p>
        </section>

        <section className="rounded-xl border border-[var(--brand-mint)]/40 bg-[var(--brand-cream)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
          <div>
            <h3 className="font-bold text-base text-[var(--brand-green)]">Questions About an Active Shipment?</h3>
            <p className="text-xs text-[rgba(0,0,0,0.65)] mt-1">
              Our Dhaka-based customer concierge is available Saturday through Thursday, 9:00 AM &ndash; 8:00 PM.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button asChild size="sm">
              <a href="tel:+8801700000000">Call +880 1700 000000</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/products">Shop Catalog</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
