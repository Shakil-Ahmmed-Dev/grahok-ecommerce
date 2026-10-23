export const ORDER_STATUSES = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
] as const;
export type TOrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type TPaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ["cod", "card", "manual"] as const;
export type TPaymentMethod = (typeof PAYMENT_METHODS)[number];

export const DEFAULT_CURRENCY = "USD";
export const DEFAULT_BASE_SHIPPING_FEE = 10.0;
export const FREE_SHIPPING_THRESHOLD = 100.0;
export const SHIPPING_RATE_PER_KG = 2.0;
export const DEFAULT_TAX_RATE = 0.0;

export const ACTIVE_ORDER_STATUSES: readonly TOrderStatus[] = [
    "pending",
    "processing",
    "shipped",
];

export const CANCELLABLE_ORDER_STATUSES: readonly TOrderStatus[] = [
    "pending",
    "processing",
];
