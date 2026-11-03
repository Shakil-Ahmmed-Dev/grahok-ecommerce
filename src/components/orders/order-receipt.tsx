"use client";

import * as React from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Home,
  XCircle,
  Copy,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProductImage } from "@/components/ui/product-image";
import { formatCurrencyBDT } from "@/lib/utils";
import type { TOrderDTO, TOrderItemDTO } from "@/features/checkout/types";

interface OrderReceiptProps {
  orderId: string;
  initialToken?: string;
}

const TIMELINE_STEPS = [
  { key: "pending", label: "Placed", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "processing", label: "Processing", icon: Package },
  { key: "shipped", label: "Shipped", icon: Truck },
  { key: "delivered", label: "Delivered", icon: Home },
];

export function OrderReceipt({ orderId, initialToken }: OrderReceiptProps) {
  const [order, setOrder] = React.useState<TOrderDTO | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  // Cancellation state
  const [cancelModalOpen, setCancelModalOpen] = React.useState(false);
  const [cancelReason, setCancelReason] = React.useState("");
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const token = React.useMemo(() => {
    if (initialToken) return initialToken;
    if (typeof window !== "undefined") {
      try {
        return window.sessionStorage.getItem(`guest_token_${orderId}`) || undefined;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }, [initialToken, orderId]);

  React.useEffect(() => {
    let isCancelled = false;

    async function load() {
      try {
        const url = `/api/v1/checkout/${orderId}${token ? `?token=${encodeURIComponent(token)}` : ""}`;
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error("Unable to locate order details. Check your order reference or sign in.");
        }
        const data = await res.json();
        if (!isCancelled) {
          setOrder(data);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "Failed to load order receipt.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      isCancelled = true;
    };
  }, [orderId, token]);

  const copyOrderNumber = () => {
    if (!order?.orderNumber) return;
    navigator.clipboard.writeText(order.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    setCancelError(null);
    try {
      const url = `/api/v1/checkout/${orderId}/cancel${token ? `?token=${encodeURIComponent(token)}` : ""}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason || "Customer requested cancellation" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Failed to cancel order.");
      }
      setOrder(data.data);
      setCancelModalOpen(false);
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel order.");
    } finally {
      setIsCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3">
        <Spinner className="size-8 text-[var(--brand-accent)]" />
        <span className="text-xs font-semibold text-[rgba(0,0,0,0.58)]">Loading verified order receipt...</span>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="py-16 max-w-md mx-auto text-center rounded-xl border border-[var(--border)] bg-white p-8 shadow-starbucks-card">
        <div className="size-12 rounded-full bg-red-50 text-[var(--destructive)] flex items-center justify-center mx-auto mb-4">
          <XCircle className="size-6" />
        </div>
        <h2 className="text-xl font-bold text-[var(--brand-green)]">Order Not Located</h2>
        <p className="text-xs text-[rgba(0,0,0,0.58)] mt-2 leading-relaxed">
          {error || "We could not verify this order reference. Please check your link or log in."}
        </p>
        <Button asChild className="mt-6" size="sm">
          <Link href="/products">Browse Flagship Catalog</Link>
        </Button>
      </div>
    );
  }

  const currentStepIdx = TIMELINE_STEPS.findIndex((s) => s.key === order.status);
  const isCancelled = order.status === "cancelled";
  const isCancellable = order.status === "pending" || order.status === "confirmed";

  return (
    <div className="flex flex-col gap-8">
      {/* Top Banner: Success Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[var(--border)]">
        <div className="flex items-center gap-4">
          <div className="size-14 rounded-full bg-[var(--brand-mint)]/40 text-[var(--brand-accent)] flex items-center justify-center shrink-0 shadow-2xs">
            <CheckCircle2 className="size-7" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--brand-accent)]">
              Order Confirmed & Placed
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--brand-green)] mt-0.5">
              Thank You for Your Order
            </h1>
            <p className="text-xs text-[rgba(0,0,0,0.58)] mt-1">
              Your items are reserved and will be delivered straight to your doorstep.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-1.5 bg-white p-4 rounded-xl border border-[var(--border)] shadow-starbucks-card">
          <span className="text-[11px] font-bold text-[rgba(0,0,0,0.58)] uppercase tracking-wider">
            Order Reference
          </span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-extrabold font-mono text-[var(--brand-green)] tabular-nums">
              {order.orderNumber}
            </span>
            <button
              onClick={copyOrderNumber}
              aria-label="Copy order number"
              className="text-[rgba(0,0,0,0.4)] hover:text-[var(--brand-accent)] p-1 transition-colors cursor-pointer"
            >
              {copied ? <Check className="size-3.5 text-[var(--brand-accent)]" /> : <Copy className="size-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Delivery Status Timeline */}
      <div className="rounded-xl border border-[var(--border)] bg-white p-6 sm:p-8 shadow-starbucks-card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-base font-bold text-[var(--brand-green)]">Order & Delivery Status</h2>
          {isCancelled ? (
            <Badge variant="outOfStock" className="px-3 py-1 text-xs font-semibold">
              Cancelled
            </Badge>
          ) : (
            <Badge variant="inStock" className="px-3 py-1 text-xs font-semibold capitalize">
              {order.status}
            </Badge>
          )}
        </div>

        {isCancelled ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900 flex items-start gap-3">
            <XCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-bold block mb-0.5">Order Cancelled</strong>
              <span>
                This order was cancelled. Any reserved stock has been automatically returned to
                inventory.
              </span>
            </div>
          </div>
        ) : (
          <div className="relative flex items-center justify-between max-w-2xl mx-auto py-4">
            {/* Background line */}
            <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-[var(--brand-ceramic)] rounded-full -z-0" />
            {/* Active progress line */}
            <div
              className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-[var(--brand-accent)] rounded-full -z-0 transition-all duration-500"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(100, (currentStepIdx / (TIMELINE_STEPS.length - 1)) * 100)
                )}%`,
              }}
            />

            {TIMELINE_STEPS.map((step, idx) => {
              const StepIcon = step.icon;
              const isPastOrCurrent = currentStepIdx >= idx;
              const isCurrent = currentStepIdx === idx;

              return (
                <div key={step.key} className="relative z-10 flex flex-col items-center gap-2">
                  <div
                    className={`size-10 rounded-full border-2 flex items-center justify-center transition-all ${
                      isCurrent
                        ? "border-[var(--brand-accent)] bg-white text-[var(--brand-accent)] ring-4 ring-[var(--brand-mint)]/40"
                        : isPastOrCurrent
                        ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white"
                        : "border-[var(--border)] bg-white text-[rgba(0,0,0,0.4)]"
                    }`}
                  >
                    <StepIcon className="size-4" />
                  </div>
                  <span
                    className={`text-[11px] font-semibold tracking-tight ${
                      isPastOrCurrent ? "text-[rgba(0,0,0,0.87)]" : "text-[rgba(0,0,0,0.4)]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Grid: Order Items & Delivery Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Items */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-starbucks-card">
            <h3 className="text-base font-bold text-[var(--brand-green)] pb-4 border-b border-[var(--border)]">
              Purchased Items ({order.items?.length || 0})
            </h3>

            <div className="divide-y divide-[var(--border)]">
              {order.items?.map((item: TOrderItemDTO) => (
                <div key={item.id} className="py-4 first:pt-4 last:pb-0 flex gap-4 items-center">
                  <div className="relative size-16 rounded-lg overflow-hidden bg-[var(--brand-ceramic)] shrink-0 border border-[var(--border)]">
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.title}
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[rgba(0,0,0,0.87)] truncate">{item.title}</p>
                    <p className="text-xs text-[rgba(0,0,0,0.58)] tabular-nums">
                      Qty: {item.quantity} &times; {formatCurrencyBDT(item.unitPrice)}
                    </p>
                  </div>
                  <div className="text-sm font-extrabold tabular-nums text-[var(--brand-green)]">
                    {formatCurrencyBDT(item.totalPrice)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Address & Payment Summary */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-starbucks-card flex flex-col gap-5">
            <h3 className="text-base font-bold text-[var(--brand-green)]">Delivery & Payment</h3>

            {/* Address */}
            <div className="text-xs flex flex-col gap-1">
              <span className="font-bold text-[var(--brand-green)] uppercase tracking-wider">
                Shipping Address
              </span>
              <p className="font-bold text-[rgba(0,0,0,0.87)]">{order.shippingAddress?.recipientName}</p>
              <p className="text-[rgba(0,0,0,0.65)]">{order.shippingAddress?.addressLine1}</p>
              {order.shippingAddress?.addressLine2 && (
                <p className="text-[rgba(0,0,0,0.65)]">{order.shippingAddress?.addressLine2}</p>
              )}
              <p className="text-[rgba(0,0,0,0.65)]">
                {order.shippingAddress?.city}, {order.shippingAddress?.postalCode}
              </p>
              <p className="text-[rgba(0,0,0,0.65)] font-mono tabular-nums">
                {order.shippingAddress?.phone}
              </p>
            </div>

            <Separator />

            {/* Payment Method */}
            <div className="text-xs flex flex-col gap-1">
              <span className="font-bold text-[var(--brand-green)] uppercase tracking-wider">
                Payment Method
              </span>
              <p className="font-bold text-[rgba(0,0,0,0.87)] capitalize">
                {order.paymentMethod === "cod" ? "Cash on Delivery (Doorstep Settlement)" : order.paymentMethod}
              </p>
              <p className="text-[rgba(0,0,0,0.58)] capitalize">
                Payment Status: <strong className="text-[var(--brand-green)]">{order.paymentStatus}</strong>
              </p>
            </div>

            <Separator />

            {/* Financial Summary */}
            <div className="flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between">
                <span className="text-[rgba(0,0,0,0.58)]">Subtotal</span>
                <span className="font-bold tabular-nums text-[rgba(0,0,0,0.87)]">
                  {formatCurrencyBDT(order.subtotal)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[rgba(0,0,0,0.58)]">Shipping Fee</span>
                <span className="font-bold tabular-nums text-[rgba(0,0,0,0.87)]">
                  {Number(order.shippingFee) === 0 ? "FREE" : formatCurrencyBDT(order.shippingFee)}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-bold text-[rgba(0,0,0,0.87)]">Grand Total</span>
                <span className="text-2xl font-extrabold tabular-nums text-[var(--brand-green)]">
                  {formatCurrencyBDT(order.totalAmount)}
                </span>
              </div>
            </div>

            {/* Self-service cancellation action */}
            {isCancellable && (
              <div className="pt-2">
                <Button
                  onClick={() => setCancelModalOpen(true)}
                  variant="outline"
                  size="sm"
                  className="w-full text-xs text-[var(--destructive)] hover:bg-red-50 hover:text-[var(--destructive)] border-red-200"
                >
                  Cancel This Order
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cancellation Confirmation Dialog */}
      <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--destructive)]">
              <AlertTriangle className="size-5" />
              <span>Cancel Order Confirmation</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-[rgba(0,0,0,0.58)]">
              Are you sure you want to cancel order <strong>{order.orderNumber}</strong>? Reserved
              stock will be released immediately.
            </DialogDescription>
          </DialogHeader>

          {cancelError && (
            <div className="rounded-xl bg-red-50 p-3 text-xs text-[var(--destructive)]">
              {cancelError}
            </div>
          )}

          <div className="flex flex-col gap-2 py-2">
            <label className="text-xs font-semibold text-[rgba(0,0,0,0.87)]">
              Reason for cancellation (optional):
            </label>
            <input
              type="text"
              placeholder="e.g. Ordered by mistake, changed mind"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="h-10 px-3.5 rounded-lg border border-[var(--input)] text-xs text-[var(--foreground)]"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              disabled={isCancelling}
            >
              Keep Order
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleCancelOrder}
              disabled={isCancelling}
            >
              {isCancelling ? <Spinner className="size-3.5 mr-1" /> : null}
              <span>Confirm Cancellation</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
