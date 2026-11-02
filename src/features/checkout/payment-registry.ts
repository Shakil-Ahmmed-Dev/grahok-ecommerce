import type { ComponentType } from "react";

export type PaymentMethodId = "cod" | "mfs_bkash" | "card" | "net_banking";

export interface PaymentGatewayAdapter {
  id: PaymentMethodId;
  backendPaymentMethod: "cod" | "card" | "manual";
  title: string;
  subtitle: string;
  iconName: "Truck" | "Smartphone" | "CreditCard" | "Building2";
  isAvailable: boolean;
  badge?: string;
  renderCustomInputs?: ComponentType<{
    onChange: (data: Record<string, unknown>) => void;
    disabled?: boolean;
  }>;
}

export const PAYMENT_GATEWAY_REGISTRY: PaymentGatewayAdapter[] = [
  {
    id: "cod",
    backendPaymentMethod: "cod",
    title: "Cash on Delivery (COD)",
    subtitle: "Pay cash upon doorstep delivery anywhere across Bangladesh.",
    iconName: "Truck",
    isAvailable: true,
  },
  {
    id: "mfs_bkash",
    backendPaymentMethod: "card",
    title: "Mobile Financial Services",
    subtitle: "Instant payment with bKash, Nagad, Rocket, or Upay.",
    iconName: "Smartphone",
    isAvailable: false,
    badge: "Coming Soon",
  },
  {
    id: "card",
    backendPaymentMethod: "card",
    title: "Credit or Debit Card",
    subtitle: "Visa, Mastercard, American Express & UnionPay.",
    iconName: "CreditCard",
    isAvailable: false,
    badge: "Coming Soon",
  },
  {
    id: "net_banking",
    backendPaymentMethod: "manual",
    title: "Internet Banking",
    subtitle: "Direct bank transfer across all major commercial banks.",
    iconName: "Building2",
    isAvailable: false,
    badge: "Coming Soon",
  },
];
