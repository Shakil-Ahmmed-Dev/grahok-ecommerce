import {
    resolveEffectiveAllowBackorder,
    reserveVariantInventory,
    releaseVariantInventory,
    reserveCartInventory,
} from "@/features/products/inventory";
import type { InventoryExecutor } from "@/features/products/inventory";
import { ConflictError, BadRequestError } from "@/lib/error";

async function runConcurrencyInventoryTestSuite() {
    console.log("=== Concurrency & Inventory Reservation Primitives Test Suite ===");

    // 1. Test resolveEffectiveAllowBackorder Hierarchy
    console.assert(resolveEffectiveAllowBackorder(true, false) === true, "Variant true overrides product false");
    console.assert(resolveEffectiveAllowBackorder(false, true) === false, "Variant false overrides product true");
    console.assert(resolveEffectiveAllowBackorder(null, true) === true, "Variant null inherits product true");
    console.assert(resolveEffectiveAllowBackorder(undefined, false) === false, "Variant undefined inherits product false");
    console.assert(resolveEffectiveAllowBackorder(null, null) === false, "Defaults to false when both null");
    console.assert(resolveEffectiveAllowBackorder(undefined, undefined) === false, "Defaults to false when both undefined");

    const varId1 = "123e4567-e89b-12d3-a456-426614174001";
    const prodId1 = "987e6543-e89b-12d3-a456-426614174001";

    // 2. Test Discrete Reservation (Sufficient Stock)
    let currentStock = 10;
    let expectedQty = 4;
    const mockDiscreteExecutor = {
        query: {
            productVariantsTable: {
                findFirst: async () => ({
                    id: varId1,
                    productId: prodId1,
                    title: "Medium",
                    sku: "shirt-m",
                    stock: currentStock.toString(),
                    inventoryType: "discrete" as const,
                    allowBackorder: null,
                    isActive: true,
                    deletedAt: null,
                    product: {
                        id: prodId1,
                        name: "Casual Shirt",
                        inventoryType: "discrete" as const,
                        allowBackorder: false,
                        stock: currentStock.toString(),
                        deletedAt: null,
                    },
                }),
            },
        },
        update: () => ({
            set: () => ({
                where: () => ({
                    returning: async () => {
                        // Atomic check: WHERE stock >= expectedQty
                        if (currentStock >= expectedQty) {
                            currentStock -= expectedQty;
                            return [{ id: varId1, stock: currentStock.toString() }];
                        }
                        return []; // No rows updated if condition fails
                    },
                }),
            }),
        }),
    } as unknown as InventoryExecutor;

    const res1 = await reserveVariantInventory({
        variantId: varId1,
        quantity: 4,
        executor: mockDiscreteExecutor,
    });
    console.assert(res1.success === true, "Discrete reservation succeeded");
    console.assert(res1.remainingStock === 6, "Remaining stock decremented to 6");
    console.assert(res1.isBackordered === false, "Not backordered");

    // 3. Test Discrete Reservation (Insufficient Stock, allowBackorder = false -> Throws ConflictError)
    expectedQty = 10;
    let threwConflict = false;
    try {
        await reserveVariantInventory({
            variantId: varId1,
            quantity: 10, // Only 6 available
            executor: mockDiscreteExecutor,
        });
    } catch (err: unknown) {
        if (err instanceof ConflictError || (err instanceof Error && "statusCode" in err && err.statusCode === 409)) {
            threwConflict = true;
        }
    }
    console.assert(threwConflict, "Throws ConflictError when stock < quantity and allowBackorder is false");

    // 4. Test Discrete Reservation (Insufficient Stock, allowBackorder = true -> Succeeds with isBackordered = true)
    const mockBackorderExecutor = {
        query: {
            productVariantsTable: {
                findFirst: async () => ({
                    id: varId1,
                    productId: prodId1,
                    title: "Medium",
                    sku: "shirt-m",
                    stock: "2",
                    inventoryType: "discrete" as const,
                    allowBackorder: true, // Explicitly allowed
                    isActive: true,
                    deletedAt: null,
                    product: {
                        id: prodId1,
                        name: "Casual Shirt",
                        inventoryType: "discrete" as const,
                        allowBackorder: false,
                        stock: "2",
                        deletedAt: null,
                    },
                }),
            },
        },
        update: () => ({
            set: () => ({
                where: () => ({
                    returning: async () => [{ id: varId1, stock: "-3" }], // 2 - 5 = -3
                }),
            }),
        }),
    } as unknown as InventoryExecutor;

    const backorderRes = await reserveVariantInventory({
        variantId: varId1,
        quantity: 5,
        executor: mockBackorderExecutor,
    });
    console.assert(backorderRes.success === true, "Backorder reservation succeeded");
    console.assert(backorderRes.isBackordered === true, "isBackordered flag is true");
    console.assert(backorderRes.remainingStock === -3, "Remaining stock can go negative on backorder");

    // 5. Test Shared Pool Reservation (Master Pool = 50kg, consumption rate = 0.5kg/unit)
    let poolStock = 50;
    const mockPoolExecutor = {
        query: {
            productVariantsTable: {
                findFirst: async () => ({
                    id: varId1,
                    productId: prodId1,
                    title: "500g Jar",
                    sku: "honey-500g",
                    stock: "0",
                    poolConsumptionRate: "0.5",
                    inventoryType: "shared_pool" as const,
                    allowBackorder: null,
                    isActive: true,
                    deletedAt: null,
                    product: {
                        id: prodId1,
                        name: "Raw Honey",
                        inventoryType: "shared_pool" as const,
                        poolStock: poolStock.toString(),
                        allowBackorder: false,
                        deletedAt: null,
                    },
                }),
            },
        },
        update: () => ({
            set: () => ({
                where: () => ({
                    returning: async () => {
                        // 10 units * 0.5 = 5kg needed
                        if (poolStock >= 5) {
                            poolStock -= 5;
                            return [{ id: prodId1, poolStock: poolStock.toString() }];
                        }
                        return [];
                    },
                }),
            }),
        }),
    } as unknown as InventoryExecutor;

    const poolRes = await reserveVariantInventory({
        variantId: varId1,
        quantity: 10,
        executor: mockPoolExecutor,
    });
    console.assert(poolRes.success === true, "Shared pool reservation succeeded");
    console.assert(poolRes.remainingStock === 90, "Remaining units derived from remaining pool: 45 / 0.5 = 90");
    console.assert(poolRes.isBackordered === false, "Not backordered in shared pool");

    // 6. Test No Tracking Reservation
    const mockNoTrackExecutor = {
        query: {
            productVariantsTable: {
                findFirst: async () => ({
                    id: varId1,
                    productId: prodId1,
                    title: "Digital Key",
                    sku: "software-key",
                    stock: "0",
                    inventoryType: "no_tracking" as const,
                    allowBackorder: null,
                    isActive: true,
                    deletedAt: null,
                    product: {
                        id: prodId1,
                        name: "Software",
                        inventoryType: "no_tracking" as const,
                        allowBackorder: false,
                        deletedAt: null,
                    },
                }),
            },
        },
    } as unknown as InventoryExecutor;

    const noTrackRes = await reserveVariantInventory({
        variantId: varId1,
        quantity: 100,
        executor: mockNoTrackExecutor,
    });
    console.assert(noTrackRes.success === true, "No tracking reservation succeeded");
    console.assert(noTrackRes.isUnlimited === true, "No tracking isUnlimited is true");
    console.assert(noTrackRes.remainingStock === null, "No tracking remainingStock is null");

    // 7. Test Release Inventory (Restoration / Cancellation)
    let discreteRestocked = 6;
    const mockReleaseExecutor = {
        query: {
            productVariantsTable: {
                findFirst: async () => ({
                    id: varId1,
                    productId: prodId1,
                    inventoryType: "discrete" as const,
                    product: {
                        id: prodId1,
                        inventoryType: "discrete" as const,
                    },
                }),
            },
        },
        update: () => ({
            set: () => ({
                where: () => ({
                    returning: async () => {
                        discreteRestocked += 4;
                        return [{ id: varId1, stock: discreteRestocked.toString() }];
                    },
                }),
            }),
        }),
    } as unknown as InventoryExecutor;

    const releaseRes = await releaseVariantInventory({
        variantId: varId1,
        quantity: 4,
        executor: mockReleaseExecutor,
    });
    console.assert(releaseRes.success === true, "Release inventory succeeded");
    console.assert(releaseRes.newStock === 10, "Stock restored back to 10");

    // 8. Test Invalid Quantity Rejection
    let invalidQtyThrew = false;
    try {
        await reserveVariantInventory({
            variantId: varId1,
            quantity: -1,
            executor: mockDiscreteExecutor,
        });
    } catch (err: unknown) {
        if (err instanceof BadRequestError || (err instanceof Error && "statusCode" in err && err.statusCode === 400)) {
            invalidQtyThrew = true;
        }
    }
    console.assert(invalidQtyThrew, "Rejects non-positive reservation quantity");

    // 9. Test Batch Cart Reservation
    let batchStock = 10;
    const mockBatchExecutor = {
        query: {
            productVariantsTable: {
                findFirst: async () => ({
                    id: varId1,
                    productId: prodId1,
                    title: "Medium",
                    sku: "shirt-m",
                    stock: batchStock.toString(),
                    inventoryType: "discrete" as const,
                    allowBackorder: false,
                    isActive: true,
                    deletedAt: null,
                    product: {
                        id: prodId1,
                        name: "Casual Shirt",
                        inventoryType: "discrete" as const,
                        allowBackorder: false,
                        stock: batchStock.toString(),
                        deletedAt: null,
                    },
                }),
            },
        },
        update: () => ({
            set: () => ({
                where: () => ({
                    returning: async () => {
                        batchStock -= 2;
                        return [{ id: varId1, stock: batchStock.toString() }];
                    },
                }),
            }),
        }),
    } as unknown as InventoryExecutor;

    const batchRes = await reserveCartInventory(
        [
            { variantId: varId1, quantity: 2 },
        ],
        { executor: mockBatchExecutor }
    );
    console.assert(batchRes.length === 1, "Batch cart reservation completed 1 item");
    console.assert(batchRes[0].remainingStock === 8, "Batch reserved 2 items successfully");

    console.log("✔ All Concurrency & Inventory Reservation Primitives tests passed! 🎯");
}

runConcurrencyInventoryTestSuite().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});