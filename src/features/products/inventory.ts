import { type TInventoryType } from "./constants";

/**
 * Resolves the effective inventory type for a variant.
 * If the variant explicitly defines an inventory type, it takes precedence.
 * Otherwise, falls back to the product's inventory policy, defaulting to "discrete".
 */
export function resolveEffectiveInventoryType(
    variantInventoryType?: TInventoryType | null,
    productInventoryType?: TInventoryType | null
): TInventoryType {
    return variantInventoryType ?? productInventoryType ?? "discrete";
}

export interface CalculateVariantStockParams {
    masterPoolStock?: number | null;
    inventoryType: TInventoryType;
    variantStock?: number | null;
    poolConsumptionRate?: number | null;
}

export interface CalculateVariantStockResult {
    stock: number | null;
    isUnlimited: boolean;
    inventoryType: TInventoryType;
}

/**
 * Calculates effective available stock and availability policy for a product variant.
 * - 'no_tracking': stock = null, isUnlimited = true (always purchasable, digital/service/untracked goods).
 * - 'discrete': stock = variantStock, isUnlimited = false (variant's own dedicated stock count).
 * - 'shared_pool': stock = masterPoolStock / (poolConsumptionRate || 1), isUnlimited = false (derived from master pool).
 */
export function calculateVariantStock({
    masterPoolStock,
    inventoryType,
    variantStock,
    poolConsumptionRate,
}: CalculateVariantStockParams): CalculateVariantStockResult {
    if (inventoryType === "no_tracking") {
        return {
            stock: null,
            isUnlimited: true,
            inventoryType: "no_tracking",
        };
    }

    if (inventoryType === "discrete") {
        return {
            stock: variantStock != null ? Math.max(0, Math.floor(Number(variantStock))) : 0,
            isUnlimited: false,
            inventoryType: "discrete",
        };
    }

    // shared_pool
    const pool = Number(masterPoolStock ?? 0);
    if (pool <= 0) {
        return {
            stock: 0,
            isUnlimited: false,
            inventoryType: "shared_pool",
        };
    }

    const rate = poolConsumptionRate != null && Number(poolConsumptionRate) > 0
        ? Number(poolConsumptionRate)
        : 1;

    const stock = Math.floor(pool / rate);

    return {
        stock: Math.max(0, stock),
        isUnlimited: false,
        inventoryType: "shared_pool",
    };
}
