export const PRODUCT_STATUSES = ["draft", "published", "archived", "scheduled"] as const;
export const WEIGHT_UNITS = ["g", "kg", "mg", "ml", "l", "oz", "lb", "pcs"] as const;
export type TWeightUnit = (typeof WEIGHT_UNITS)[number];

export const INVENTORY_TYPES = ["discrete", "shared_pool"] as const;
export type TInventoryType = (typeof INVENTORY_TYPES)[number];