"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  AlertCircle,
  Truck,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Empty } from "@/components/ui/empty";
import { ProductImage } from "@/components/ui/product-image";
import { PaymentMethodSelector } from "./payment-method-selector";
import { useCart } from "@/context/cart-context";
import { useSession } from "@/lib/better-auth/client";
import { formatCurrencyBDT } from "@/lib/utils";
import { PAYMENT_GATEWAY_REGISTRY, type PaymentMethodId } from "@/features/checkout/payment-registry";

interface EstimateData {
  subtotal: number;
  shippingFee: number;
  tax: number;
  discount: number;
  totalAmount: number;
  isReadyForCheckout: boolean;
  warnings: string[];
}

export function CheckoutForm() {
  const router = useRouter();
  const { items, subtotal: cartSubtotal, clearCart, isMounted } = useCart();
  const { data: session } = useSession();

  // Contact Form State
  const [email, setEmail] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");

  // Address Form State
  const [recipientName, setRecipientName] = React.useState("");
  const [phonePrefix] = React.useState("+880");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [addressLine1, setAddressLine1] = React.useState("");
  const [addressLine2, setAddressLine2] = React.useState("");
  const [city, setCity] = React.useState("Dhaka");
  const [postalCode, setPostalCode] = React.useState("");
  const [saveAddress, setSaveAddress] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  // Payment Method
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethodId>("cod");

  // Estimation & Submission state
  const [estimate, setEstimate] = React.useState<EstimateData | null>(null);
  const [isEstimating, setIsEstimating] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Form Validation errors
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  // Pre-fill user data when session becomes available
  React.useEffect(() => {
    if (!session?.user) return;
    const timer = setTimeout(() => {
      if (session.user.email && !email) setEmail(session.user.email);
      if (session.user.name && !recipientName) {
        setRecipientName(session.user.name);
        const parts = session.user.name.split(" ");
        if (parts.length > 0 && !firstName) setFirstName(parts[0]);
        if (parts.length > 1 && !lastName) setLastName(parts.slice(1).join(" "));
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [session, email, recipientName, firstName, lastName]);

  // Combined E.164 phone string
  const fullPhone = React.useMemo(() => {
    const cleanNum = phoneNumber.replace(/[\s\-\(\)]/g, "");
    if (cleanNum.startsWith("+")) return cleanNum;
    const cleanDigits = cleanNum.replace(/^0+/, "");
    return `${phonePrefix}${cleanDigits}`;
  }, [phonePrefix, phoneNumber]);

  // Live Valuation Estimate API call
  React.useEffect(() => {
    if (!isMounted || items.length === 0) return;

    let isCancelled = false;

    const timer = setTimeout(async () => {
      setIsEstimating(true);
      try {
        const payload = {
          items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
          shippingAddress: {
            recipientName: recipientName.trim() || "Customer",
            phone: fullPhone.length >= 10 ? fullPhone : "+8801700000000",
            addressLine1: addressLine1.trim() || "Bangladesh",
            city: city.trim() || "Dhaka",
            postalCode: postalCode.trim() || "1000",
            countryCode: "BD",
          },
        };

        const res = await fetch("/api/v1/checkout/estimate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (res.ok && !isCancelled) {
          const data = await res.json();
          setEstimate(data);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!isCancelled) setIsEstimating(false);
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [items, recipientName, fullPhone, addressLine1, city, postalCode, isMounted]);

  const validate = () => {
    const errs: Record<string, string> = {};

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = "Please provide a valid email address";
    }

    if (!recipientName.trim()) {
      errs.recipientName = "Full recipient name is required";
    }

    if (!phoneNumber.trim()) {
      errs.phoneNumber = "Phone number is required";
    } else if (!/^\+[1-9]\d{6,14}$/.test(fullPhone)) {
      errs.phoneNumber = "Please enter a valid phone number (e.g. 1712345678)";
    }

    if (!addressLine1.trim()) {
      errs.addressLine1 = "Street address is required";
    }

    if (!city.trim()) {
      errs.city = "City / District is required";
    }

    if (!postalCode.trim()) {
      errs.postalCode = "Postal code is required";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    if (items.length === 0) {
      setSubmitError("Your shopping bag is empty.");
      return;
    }

    if (estimate && !estimate.isReadyForCheckout) {
      setSubmitError("Some items in your cart are no longer available in the requested quantity.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
        shippingAddress: {
          recipientName: recipientName.trim(),
          phone: fullPhone,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || undefined,
          city: city.trim(),
          postalCode: postalCode.trim(),
          countryCode: "BD",
        },
        paymentMethod: (PAYMENT_GATEWAY_REGISTRY.find((m) => m.id === paymentMethod)?.backendPaymentMethod ?? "cod") as "cod",
        saveShippingAddress: saveAddress,
        customer: session?.user
          ? undefined
          : {
              email: email.trim().toLowerCase(),
              firstName: firstName.trim() || undefined,
              lastName: lastName.trim() || undefined,
              phone: fullPhone,
            },
        notes: notes.trim() || undefined,
      };

      const res = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error?.message || "Failed to process your order. Please check inputs.");
        setIsSubmitting(false);
        return;
      }

      const createdOrder = data.data;
      if (!createdOrder?.id) {
        setSubmitError("Failed to retrieve placed order confirmation.");
        setIsSubmitting(false);
        return;
      }

      // Clear local cart
      clearCart();

      // Navigate to order-confirmed
      const tokenParam = createdOrder.guestAccessToken
        ? `&token=${encodeURIComponent(createdOrder.guestAccessToken)}`
        : "";
      router.push(`/order-confirmed?orderId=${createdOrder.id}${tokenParam}`);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : "A network error occurred. Please try again."
      );
      setIsSubmitting(false);
    }
  };

  // If cart is empty on checkout page, show clear empty state
  if (isMounted && items.length === 0) {
    return (
      <div className="py-16 flex flex-col items-center justify-center text-center">
        <Empty
          icon={<ShoppingBag className="size-10 text-[var(--brand-green)]" />}
          title="Your Shopping Bag is Empty"
          description="Please add items to your shopping bag before proceeding to complete an order."
          action={
            <Button asChild size="lg">
              <Link href="/products">
                <span>Explore Catalog</span>
                <ArrowRight className="size-4 ml-2" />
              </Link>
            </Button>
          }
        />
      </div>
    );
  }

  const finalSubtotal = estimate?.subtotal ?? cartSubtotal;
  const finalShipping = estimate?.shippingFee ?? (finalSubtotal >= 100 ? 0 : 10);
  const finalTotal = estimate?.totalAmount ?? finalSubtotal + finalShipping;

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
      {/* Left Column: Checkout Steps */}
      <div className="lg:col-span-7 flex flex-col gap-10">
        {/* Error Alert */}
        {submitError && (
          <div className="rounded-xl border border-[var(--destructive)]/30 bg-red-50 p-4 text-[var(--destructive)] flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="font-bold block mb-0.5">Order Placement Issue</strong>
              <span>{submitError}</span>
            </div>
          </div>
        )}

        {/* Step 1: Contact Information */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
            <div className="size-6 rounded-full bg-[var(--brand-green)] text-white text-xs font-bold flex items-center justify-center">
              1
            </div>
            <h2 className="text-base font-bold text-[var(--brand-green)]">Contact Information</h2>
            {session?.user && (
              <span className="text-xs text-[rgba(0,0,0,0.58)] ml-auto">
                Logged in as <strong className="text-[rgba(0,0,0,0.87)]">{session.user.email}</strong>
              </span>
            )}
          </div>

          <FieldGroup>
            <Field invalid={Boolean(errors.email)}>
              <FieldLabel required>Email Address</FieldLabel>
              <Input
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={Boolean(errors.email)}
                disabled={Boolean(session?.user?.email)}
              />
              <FieldDescription>
                We&apos;ll send your order confirmation and doorstep delivery updates here.
              </FieldDescription>
              <FieldError message={errors.email} />
            </Field>

            {!session?.user && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field>
                  <FieldLabel>First Name</FieldLabel>
                  <Input
                    placeholder="John"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel>Last Name</FieldLabel>
                  <Input
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                  />
                </Field>
              </div>
            )}
          </FieldGroup>
        </section>

        {/* Step 2: Shipping Address */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
            <div className="size-6 rounded-full bg-[var(--brand-green)] text-white text-xs font-bold flex items-center justify-center">
              2
            </div>
            <h2 className="text-base font-bold text-[var(--brand-green)]">Shipping Address</h2>
          </div>

          <FieldGroup>
            <Field invalid={Boolean(errors.recipientName)}>
              <FieldLabel required>Recipient Full Name</FieldLabel>
              <Input
                placeholder="John Doe"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                aria-invalid={Boolean(errors.recipientName)}
              />
              <FieldError message={errors.recipientName} />
            </Field>

            <Field invalid={Boolean(errors.phoneNumber)}>
              <FieldLabel required>Phone Number (for Courier & SMS)</FieldLabel>
              <div className="flex gap-2">
                <div className="flex items-center justify-center px-3.5 rounded-lg border border-[var(--input)] bg-[var(--brand-ceramic)] text-xs font-bold text-[rgba(0,0,0,0.87)] select-none">
                  +880
                </div>
                <Input
                  type="tel"
                  placeholder="1712345678"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  aria-invalid={Boolean(errors.phoneNumber)}
                  className="flex-1 tabular-nums"
                />
              </div>
              <FieldDescription>
                Required for nationwide courier delivery verification upon arrival.
              </FieldDescription>
              <FieldError message={errors.phoneNumber} />
            </Field>

            <Field invalid={Boolean(errors.addressLine1)}>
              <FieldLabel required>Street Address & House / Flat</FieldLabel>
              <Input
                placeholder="House 12, Road 4, Sector 3, Uttara"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                aria-invalid={Boolean(errors.addressLine1)}
              />
              <FieldError message={errors.addressLine1} />
            </Field>

            <Field>
              <FieldLabel>Apartment, suite, unit (optional)</FieldLabel>
              <Input
                placeholder="Apt 4B"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field invalid={Boolean(errors.city)}>
                <FieldLabel required>City / District</FieldLabel>
                <Input
                  placeholder="Dhaka"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  aria-invalid={Boolean(errors.city)}
                />
                <FieldError message={errors.city} />
              </Field>

              <Field invalid={Boolean(errors.postalCode)}>
                <FieldLabel required>Postal Code</FieldLabel>
                <Input
                  placeholder="1230"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  aria-invalid={Boolean(errors.postalCode)}
                  className="tabular-nums"
                />
                <FieldError message={errors.postalCode} />
              </Field>

              <Field>
                <FieldLabel required>Country</FieldLabel>
                <div className="h-10 flex items-center px-3.5 rounded-lg border border-[var(--input)] bg-[var(--brand-ceramic)] text-xs font-semibold text-[rgba(0,0,0,0.87)]">
                  Bangladesh (BD)
                </div>
              </Field>
            </div>

            {session?.user && (
              <label className="flex items-center gap-2 pt-2 text-xs font-semibold text-[rgba(0,0,0,0.87)] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.checked)}
                  className="size-4 rounded accent-[var(--brand-accent)] cursor-pointer"
                />
                <span>Save this address to my account address book</span>
              </label>
            )}

            <Field>
              <FieldLabel>Delivery Instructions or Notes (optional)</FieldLabel>
              <Input
                placeholder="e.g. Call upon arrival or leave with security"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
          </FieldGroup>
        </section>

        {/* Step 3: Payment Method Selector */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-[var(--border)]">
            <div className="size-6 rounded-full bg-[var(--brand-green)] text-white text-xs font-bold flex items-center justify-center">
              3
            </div>
            <h2 className="text-base font-bold text-[var(--brand-green)]">Payment Method</h2>
          </div>

          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
            disabled={isSubmitting}
          />
        </section>
      </div>

      {/* Right Column: Order Summary Card */}
      <div className="lg:col-span-5">
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-starbucks-card sticky top-28 flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
            <h3 className="text-lg font-bold text-[var(--brand-green)]">Order Summary</h3>
            {isEstimating && <Spinner className="size-4 text-[var(--brand-accent)]" />}
          </div>

          {/* Warnings */}
          {estimate?.warnings && estimate.warnings.length > 0 && (
            <div className="rounded-xl border border-[var(--brand-gold-light)] bg-[var(--brand-gold-lightest)] p-3 text-xs text-[var(--foreground)] flex flex-col gap-1">
              {estimate.warnings.map((w, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <AlertCircle className="size-3.5 shrink-0 mt-0.5 text-[var(--brand-gold)]" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Line Items List */}
          <div className="flex flex-col divide-y divide-[var(--border)] max-h-60 overflow-y-auto pr-1">
            {items.map((item) => (
              <div key={item.variantId} className="py-3 first:pt-0 last:pb-0 flex gap-3 items-center">
                <div className="relative size-14 rounded-lg overflow-hidden bg-[var(--brand-ceramic)] shrink-0 border border-[var(--border)]">
                  <ProductImage
                    src={item.imageUrl}
                    alt={item.title}
                    fill
                    className="object-cover"
                    sizes="56px"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-[rgba(0,0,0,0.87)] truncate">{item.title}</p>
                  {item.variantTitle && (
                    <p className="text-[11px] text-[rgba(0,0,0,0.58)] truncate">{item.variantTitle}</p>
                  )}
                  <p className="text-xs text-[rgba(0,0,0,0.58)] tabular-nums">Qty: {item.quantity}</p>
                </div>
                <div className="text-xs font-bold tabular-nums text-[var(--brand-green)]">
                  {formatCurrencyBDT(item.price * item.quantity)}
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Price Breakdown */}
          <div className="flex flex-col gap-2.5 text-xs">
            <div className="flex justify-between">
              <span className="text-[rgba(0,0,0,0.58)]">Subtotal</span>
              <span className="font-bold tabular-nums text-[rgba(0,0,0,0.87)]">
                {formatCurrencyBDT(finalSubtotal)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[rgba(0,0,0,0.58)]">Doorstep Delivery</span>
              <span className="font-bold tabular-nums text-[rgba(0,0,0,0.87)]">
                {finalShipping === 0 ? (
                  <span className="text-[var(--brand-accent)] font-bold">FREE</span>
                ) : (
                  formatCurrencyBDT(finalShipping)
                )}
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between items-baseline">
            <span className="text-base font-bold text-[rgba(0,0,0,0.87)]">Total to Pay</span>
            <span className="text-2xl font-extrabold tabular-nums text-[var(--brand-green)]">
              {formatCurrencyBDT(finalTotal)}
            </span>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || items.length === 0}
            size="lg"
            className="w-full h-12 text-sm font-semibold shadow-xs"
          >
            {isSubmitting ? (
              <>
                <Spinner data-icon="inline-start" className="mr-2" />
                <span>Confirming Order...</span>
              </>
            ) : (
              <>
                <span>Confirm & Place Order</span>
                <ArrowRight className="size-4 ml-2" />
              </>
            )}
          </Button>

          <div className="flex flex-col gap-2 pt-3 text-xs text-[rgba(0,0,0,0.65)] border-t border-[var(--border)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-3.5 text-[var(--brand-accent)]" />
              <span>100% Encrypted & Safe Order Placement</span>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="size-3.5 text-[var(--brand-accent)]" />
              <span>Doorstep verification & cash settlement</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
