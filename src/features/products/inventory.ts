import { type TInventoryType } from "./constants";
import { db } from "@/lib/drizzle";
import { productsTable, productVariantsTable } from "@/lib/drizzle/schemas/public";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/error";
import { VariantIdSchema } from "./types";

export type InventoryExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

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

/**
 * Resolves the effective backorder policy for a variant.
 * If the variant explicitly defines allowBackorder (true/false), it takes precedence.
 * Otherwise, falls back to the product's allowBackorder policy, defaulting to false.
 */
export function resolveEffectiveAllowBackorder(
    variantAllowBackorder?: boolean | null,
    productAllowBackorder?: boolean | null
): boolean {
    return variantAllowBackorder ?? productAllowBackorder ?? false;
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

export interface ReserveVariantInventoryParams {
    variantId: string;
    quantity: number;
    executor?: InventoryExecutor;
}

export interface ReserveVariantInventoryResult {
    success: boolean;
    variantId: string;
    productId: string;
    inventoryType: TInventoryType;
    quantityReserved: number;
    remainingStock: number | null;
    isBackordered: boolean;
    isUnlimited: boolean;
}

/**
 * Performs an atomic database reservation (decrement) for a product variant.
 * - 'no_tracking': Bypasses deductions.
 * - 'discrete': Atomically decrements product_variants.stock WHERE stock >= qty (or allowBackorder is true).
 * - 'shared_pool': Atomically decrements products.pool_stock WHERE pool_stock >= (qty * rate) (or allowBackorder is true).
 */
export async function reserveVariantInventory({
    variantId,
    quantity,
    executor,
}: ReserveVariantInventoryParams): Promise<ReserveVariantInventoryResult> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestError("Reservation quantity must be a positive integer");
    }

    VariantIdSchema.parse(variantId);
    const client = executor ?? db;

    const variant = await client.query.productVariantsTable.findFirst({
        where: (v, { eq, and, isNull }) => and(eq(v.id, variantId), isNull(v.deletedAt)),
        with: {
            product: true,
        },
    });

    if (!variant || !variant.product || variant.product.deletedAt) {
        throw new NotFoundError(`Active product variant '${variantId}' not found`);
    }

    if (!variant.isActive) {
        throw new ConflictError(`Variant '${variant.title}' (${variant.sku}) is inactive and cannot be purchased`);
    }

    const product = variant.product;
    const inventoryType = resolveEffectiveInventoryType(variant.inventoryType, product.inventoryType);
    const allowBackorder = resolveEffectiveAllowBackorder(variant.allowBackorder, product.allowBackorder);

    if (inventoryType === "no_tracking") {
        return {
            success: true,
            variantId: variant.id,
            productId: product.id,
            inventoryType: "no_tracking",
            quantityReserved: quantity,
            remainingStock: null,
            isBackordered: false,
            isUnlimited: true,
        };
    }

    if (inventoryType === "discrete") {
        const whereConditions = [
            eq(productVariantsTable.id, variant.id),
            isNull(productVariantsTable.deletedAt),
        ];

        if (!allowBackorder) {
            whereConditions.push(gte(productVariantsTable.stock, quantity));
        }

        const [updatedVariant] = await client
            .update(productVariantsTable)
            .set({
                stock: sql`${productVariantsTable.stock} - ${quantity}`,
            })
            .where(and(...whereConditions))
            .returning();

        if (!updatedVariant) {
            const currentStock = Number(variant.stock ?? 0);
            throw new ConflictError(
                `Insufficient stock for '${product.name} - ${variant.title}'. Requested: ${quantity}, Available: ${currentStock}`
            );
        }

        const remaining = Number(updatedVariant.stock);

        if (product.inventoryType === "discrete") {
            await client
                .update(productsTable)
                .set({
                    stock: sql`${productsTable.stock} - ${quantity}`,
                })
                .where(eq(productsTable.id, product.id));
        }

        return {
            success: true,
            variantId: variant.id,
            productId: product.id,
            inventoryType: "discrete",
            quantityReserved: quantity,
            remainingStock: remaining,
            isBackordered: remaining < 0 || Number(variant.stock) < quantity,
            isUnlimited: false,
        };
    }

    // shared_pool
    const rate = variant.poolConsumptionRate != null && Number(variant.poolConsumptionRate) > 0
        ? Number(variant.poolConsumptionRate)
        : 1;
    const poolUnitsNeeded = quantity * rate;

    const whereConditions = [
        eq(productsTable.id, product.id),
        isNull(productsTable.deletedAt),
    ];

    if (!allowBackorder) {
        whereConditions.push(gte(productsTable.poolStock, poolUnitsNeeded));
    }

    const [updatedProduct] = await client
        .update(productsTable)
        .set({
            poolStock: sql`${productsTable.poolStock} - ${poolUnitsNeeded}`,
        })
        .where(and(...whereConditions))
        .returning();

    if (!updatedProduct) {
        const currentPool = Number(product.poolStock ?? 0);
        const maxQty = Math.floor(currentPool / rate);
        throw new ConflictError(
            `Insufficient shared pool inventory for '${product.name}'. Requested: ${quantity} units (${poolUnitsNeeded} pool units), Available: ${maxQty} units (${currentPool} pool units)`
        );
    }

    const remainingPool = Number(updatedProduct.poolStock);
    const remainingUnits = Math.floor(remainingPool / rate);

    return {
        success: true,
        variantId: variant.id,
        productId: product.id,
        inventoryType: "shared_pool",
        quantityReserved: quantity,
        remainingStock: Math.max(0, remainingUnits),
        isBackordered: remainingPool < 0 || Number(product.poolStock) < poolUnitsNeeded,
        isUnlimited: false,
    };
}

export interface ReleaseVariantInventoryParams {
    variantId: string;
    quantity: number;
    executor?: InventoryExecutor;
}

export interface ReleaseVariantInventoryResult {
    success: boolean;
    variantId: string;
    productId: string;
    inventoryType: TInventoryType;
    quantityReleased: number;
    newStock: number | null;
}

/**
 * Performs an atomic inventory release (increment) for cancelled or refunded line items.
 * - 'no_tracking': No-op bypass.
 * - 'discrete': Increments product_variants.stock.
 * - 'shared_pool': Increments products.pool_stock by (quantity * poolConsumptionRate).
 */
export async function releaseVariantInventory({
    variantId,
    quantity,
    executor,
}: ReleaseVariantInventoryParams): Promise<ReleaseVariantInventoryResult> {
    if (!Number.isInteger(quantity) || quantity <= 0) {
        throw new BadRequestError("Release quantity must be a positive integer");
    }

    VariantIdSchema.parse(variantId);
    const client = executor ?? db;

    const variant = await client.query.productVariantsTable.findFirst({
        where: (v, { eq }) => eq(v.id, variantId),
        with: {
            product: true,
        },
    });

    if (!variant || !variant.product) {
        throw new NotFoundError(`Product variant '${variantId}' not found`);
    }

    const product = variant.product;
    const inventoryType = resolveEffectiveInventoryType(variant.inventoryType, product.inventoryType);

    if (inventoryType === "no_tracking") {
        return {
            success: true,
            variantId: variant.id,
            productId: product.id,
            inventoryType: "no_tracking",
            quantityReleased: quantity,
            newStock: null,
        };
    }

    if (inventoryType === "discrete") {
        const [updatedVariant] = await client
            .update(productVariantsTable)
            .set({
                stock: sql`${productVariantsTable.stock} + ${quantity}`,
            })
            .where(eq(productVariantsTable.id, variant.id))
            .returning();

        if (product.inventoryType === "discrete") {
            await client
                .update(productsTable)
                .set({
                    stock: sql`${productsTable.stock} + ${quantity}`,
                })
                .where(eq(productsTable.id, product.id));
        }

        return {
            success: true,
            variantId: variant.id,
            productId: product.id,
            inventoryType: "discrete",
            quantityReleased: quantity,
            newStock: updatedVariant ? Number(updatedVariant.stock) : null,
        };
    }

    // shared_pool
    const rate = variant.poolConsumptionRate != null && Number(variant.poolConsumptionRate) > 0
        ? Number(variant.poolConsumptionRate)
        : 1;
    const poolUnitsToAdd = quantity * rate;

    const [updatedProduct] = await client
        .update(productsTable)
        .set({
            poolStock: sql`${productsTable.poolStock} + ${poolUnitsToAdd}`,
        })
        .where(eq(productsTable.id, product.id))
        .returning();

    const newPool = updatedProduct ? Number(updatedProduct.poolStock) : 0;
    const newStock = Math.floor(newPool / rate);

    return {
        success: true,
        variantId: variant.id,
        productId: product.id,
        inventoryType: "shared_pool",
        quantityReleased: quantity,
        newStock: Math.max(0, newStock),
    };
}

export interface CartReservationItem {
    variantId: string;
    quantity: number;
}

/**
 * Atomically reserves inventory for an entire batch of cart items.
 * Designed to be executed inside a checkout transaction.
 */
export async function reserveCartInventory(
    items: CartReservationItem[],
    options?: { executor?: InventoryExecutor }
): Promise<ReserveVariantInventoryResult[]> {
    if (!items || items.length === 0) {
        return [];
    }

    const results: ReserveVariantInventoryResult[] = [];
    for (const item of items) {
        const res = await reserveVariantInventory({
            variantId: item.variantId,
            quantity: item.quantity,
            executor: options?.executor,
        });
        results.push(res);
    }
    return results;
}
