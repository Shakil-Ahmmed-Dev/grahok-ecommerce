import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ShieldCheck, Lock, EyeOff, Download, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Privacy Policy & Data Governance | Grahok",
  description:
    "Review Grahok's privacy policy, data collection safeguards, encryption standards, and customer data rights.",
};

export default function PrivacyPolicyPage() {
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
        <span className="font-bold text-[var(--brand-green)]">Privacy Policy</span>
      </nav>

      {/* Header Banner */}
      <div className="pb-8 mb-10 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)] mb-2">
          <ShieldCheck className="size-4" />
          <span>Security & Governance</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--brand-green)]">
          Customer Privacy Policy
        </h1>
        <p className="text-sm text-[rgba(0,0,0,0.65)] mt-2 leading-relaxed">
          Your personal privacy and transactional security are paramount. This policy outlines how
          Grahok collects, safeguards, and handles your information.
        </p>
      </div>

      {/* Core Privacy Safeguards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <Lock className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">256-Bit Encryption</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            All data in transit is protected using modern TLS cryptographic standards.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <EyeOff className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">Zero Data Brokerage</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            We never sell, rent, or lease your personal information to third-party advertisers.
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-white p-5 shadow-starbucks-card flex flex-col gap-2">
          <Download className="size-5 text-[var(--brand-accent)]" />
          <h3 className="font-bold text-sm text-[var(--brand-green)]">Data Portability</h3>
          <p className="text-xs text-[rgba(0,0,0,0.65)] leading-relaxed">
            Full GDPR-compliant export and account anonymization tools available at any time.
          </p>
        </div>
      </div>

      {/* Policy Content */}
      <div className="flex flex-col gap-8 text-sm text-[rgba(0,0,0,0.8)] leading-relaxed">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">1. Information We Collect</h2>
          <p>
            When you browse Grahok, create an account, or complete a checkout transaction, we collect
            only the information essential to fulfill your order and provide customer care:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[rgba(0,0,0,0.7)]">
            <li>
              <strong>Account & Contact Credentials:</strong> Name, verified email address, and 11-digit Bangladeshi mobile number for courier SMS updates.
            </li>
            <li>
              <strong>Fulfillment Logistics:</strong> Doorstep shipping address, district, postal code, and optional delivery instructions.
            </li>
            <li>
              <strong>Order History & Receipts:</strong> Ordered SKUs, variant details, payment settlement status, and cryptographic guest order access tokens.
            </li>
            <li>
              <strong>Technical Session Logs:</strong> Masked IP address, user-agent details, and security audit timestamps to prevent unauthorized access or fraud.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">2. How Your Information is Utilized</h2>
          <p>
            We process customer data strictly for legitimate commerce purposes:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[rgba(0,0,0,0.7)]">
            <li>Dispatching shipments and routing delivery details to our bonded courier logistics partners.</li>
            <li>Communicating critical order status transitions (Confirmed, Shipped, In Transit, Delivered).</li>
            <li>Processing cancellations, replacements, and payment refunds.</li>
            <li>Preventing automated bot abuse and inventory exhaustion attacks.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">3. Data Sharing & Third-Party Disclosure</h2>
          <p>
            We share only the minimum required information with trusted operational service providers under strict data privacy agreements:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[rgba(0,0,0,0.7)]">
            <li><strong>Nationwide Couriers:</strong> Name, phone number, and street address shared solely for package fulfillment.</li>
            <li><strong>Authorized Payment Gateways:</strong> Encrypted transaction values communicated through regulated gateway channels. We never store raw cardholder details or CVVs.</li>
            <li><strong>Legal Authorities:</strong> Disclosed only when strictly required by Bangladeshi law or valid judicial subpoenas.</li>
          </ul>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">4. Your Privacy Rights & Self-Service Tools</h2>
          <p>
            As a registered customer, you retain complete sovereignty over your personal data:
          </p>
          <div className="rounded-xl border border-[var(--border)] bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h4 className="font-bold text-sm text-[var(--brand-green)]">Access Your Account Privacy Hub</h4>
              <p className="text-xs text-[rgba(0,0,0,0.65)] mt-0.5">
                Download a complete JSON export of your profile, addresses, and audit records, or request account anonymization.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="text-xs shrink-0">
              <Link href="/account/privacy" className="flex items-center gap-1.5">
                <span>Privacy Dashboard</span>
                <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-[var(--brand-green)]">5. Cookies & Local Storage</h2>
          <p>
            We use minimal cookies and browser storage strictly necessary for platform functionality:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-[rgba(0,0,0,0.7)]">
            <li><strong>Authentication Sessions:</strong> Secure, HTTP-only session cookies managed by our authentication server.</li>
            <li><strong>Guest Order Tokens:</strong> Stored locally in browser session to allow guest customers to view their order status without requiring an account password.</li>
            <li><strong>Shopping Bag Cache:</strong> Preserved in local storage so your bag remains intact across browser tabs.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--brand-mint)]/40 bg-[var(--brand-cream)] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
          <div>
            <h3 className="font-bold text-base text-[var(--brand-green)]">Privacy Questions or Inquiries?</h3>
            <p className="text-xs text-[rgba(0,0,0,0.65)] mt-1">
              Reach our Data Privacy Officer directly for any privacy inquiries or record requests.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button asChild size="sm">
              <a href="mailto:privacy@grahok.com">Email privacy@grahok.com</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
