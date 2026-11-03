"use client";

import * as React from "react";
import { Truck, ShieldCheck } from "lucide-react";
import {
  PAYMENT_GATEWAY_REGISTRY,
  type PaymentMethodId,
} from "@/features/checkout/payment-registry";

interface PaymentMethodSelectorProps {
  value: PaymentMethodId;
  onChange: (method: PaymentMethodId) => void;
  disabled?: boolean;
}

export function PaymentMethodSelector({
  value,
  onChange,
  disabled = false,
}: PaymentMethodSelectorProps) {
  // Filter for available methods so customer is not distracted by unclickable placeholders
  const availableMethods = PAYMENT_GATEWAY_REGISTRY.filter((m) => m.isAvailable);

  return (
    <div className="flex flex-col gap-3">
      {availableMethods.map((method) => {
        const isSelected = value === method.id;

        return (
          <div
            key={method.id}
            onClick={() => {
              if (!disabled) onChange(method.id);
            }}
            className={`relative flex items-start gap-4 rounded-xl border p-4.5 transition-all duration-150 cursor-pointer ${
              isSelected
                ? "border-[var(--brand-accent)] bg-[var(--brand-mint)]/10 ring-2 ring-[var(--brand-accent)] shadow-2xs"
                : "border-[var(--border)] bg-white hover:border-[var(--brand-accent)]/50"
            }`}
            role="radio"
            aria-checked={isSelected}
          >
            {/* Custom Radio Circle (.agents/DESIGN.md Section 4 Option Icon) */}
            <div className="pt-0.5">
              <div
                className={`size-4 rounded-full border flex items-center justify-center transition-colors ${
                  isSelected
                    ? "border-[var(--brand-accent)] bg-[var(--brand-accent)] text-white"
                    : "border-[var(--border)] bg-white"
                }`}
              >
                {isSelected && <div className="size-1.5 rounded-full bg-white" />}
              </div>
            </div>

            {/* Icon */}
            <div className="shrink-0 pt-0.5">
              <Truck className="size-5 text-[var(--brand-accent)]" />
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[rgba(0,0,0,0.87)]">
                  {method.title}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--brand-accent)] bg-[var(--brand-mint)]/40 px-2 py-0.5 rounded-full">
                  Zero Upfront Fee
                </span>
              </div>
              <p className="text-xs text-[rgba(0,0,0,0.58)] mt-1 leading-relaxed">
                {method.subtitle}
              </p>
            </div>
          </div>
        );
      })}

      {/* Reassurance note about upcoming digital channels */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-[var(--brand-ceramic)] text-xs text-[rgba(0,0,0,0.65)] mt-1">
        <ShieldCheck className="size-4 text-[var(--brand-accent)] shrink-0" />
        <span>Card & Mobile Financial Services (bKash, Nagad) are currently undergoing gateway certification.</span>
      </div>
    </div>
  );
}
