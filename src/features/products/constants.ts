export const PRODUCT_STATUSES = ["draft", "published", "archived", "scheduled"] as const;

export const INVENTORY_TYPES = ["discrete", "shared_pool", "no_tracking"] as const;
export type TInventoryType = (typeof INVENTORY_TYPES)[number];