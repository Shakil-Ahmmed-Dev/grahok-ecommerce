"use client";

import * as React from "react";
import { Truck, Smartphone, CreditCard, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  const getIcon = (iconName: string) => {
    switch (iconName) {
      case "Smartphone":
        return <Smartphone className="size-5 text-muted-foreground" />;
      case "CreditCard":
        return <CreditCard className="size-5 text-muted-foreground" />;
      case "Building2":
        return <Building2 className="size-5 text-muted-foreground" />;
      case "Truck":
      default:
        return <Truck className="size-5 text-[var(--saffron)]" />;
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {PAYMENT_GATEWAY_REGISTRY.map((method) => {
        const isSelected = value === method.id;
        const isInteractive = method.isAvailable && !disabled;

        return (
          <div
            key={method.id}
            onClick={() => {
              if (isInteractive) onChange(method.id);
            }}
            className={`relative flex items-start gap-4 rounded-xl border p-4 transition-all duration-150 ${
              !method.isAvailable
                ? "border-border/60 bg-muted/20 opacity-65 cursor-not-allowed"
                : isSelected
                ? "border-primary bg-primary/[0.02] ring-1 ring-primary cursor-pointer shadow-xs"
                : "border-border bg-card hover:border-foreground/30 hover:bg-muted/30 cursor-pointer"
            }`}
            role="radio"
            aria-checked={isSelected}
            aria-disabled={!method.isAvailable}
          >
            {/* Custom Radio Circle */}
            <div className="pt-0.5">
              <div
                className={`size-4 rounded-full border flex items-center justify-center transition-colors ${
                  isSelected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 bg-background"
                }`}
              >
                {isSelected && <div className="size-1.5 rounded-full bg-white" />}
              </div>
            </div>

            {/* Icon */}
            <div className="shrink-0 pt-0.5">{getIcon(method.iconName)}</div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">
                  {method.title}
                </span>
                {method.badge && (
                  <Badge variant="secondary" className="text-[10px] py-0 px-2 font-medium">
                    {method.badge}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                {method.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
