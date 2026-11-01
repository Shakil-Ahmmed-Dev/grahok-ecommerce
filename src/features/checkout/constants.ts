export const ORDER_STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "in_transit",
    "delivered",
    "cancelled",
    "refunded",
] as const;
export type TOrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type TPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["cod", "card", "manual"] as const;
export type TPaymentMethod = (typeof PAYMENT_METHODS)[number];

export const ENABLED_CHECKOUT_PAYMENT_METHODS = ["cod"] as const;
export type TEnabledCheckoutPaymentMethod = (typeof ENABLED_CHECKOUT_PAYMENT_METHODS)[number];

export const DEFAULT_CURRENCY = "BDT";
export const DEFAULT_BASE_SHIPPING_FEE = 10.0;
export const FREE_SHIPPING_THRESHOLD = 100.0;
export const SHIPPING_RATE_PER_KG = 2.0;
export const DEFAULT_TAX_RATE = 0.0;

export const ACTIVE_ORDER_STATUSES: readonly TOrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "in_transit",
];

export const CANCELLABLE_ORDER_STATUSES: readonly TOrderStatus[] = [
    "pending",
    "confirmed",
    "processing",
];
