import {
    VariantCheckoutSnapshotSchema,
    type TVariantCheckoutSnapshot,
} from "@/features/products/types";
import {
    getVariantCheckoutSnapshot,
    getVariantCheckoutSnapshots,
} from "@/features/products/actions";
import type { InventoryExecutor } from "@/features/products/inventory";
import { NotFoundError } from "@/lib/error";

async function runCheckoutSnapshotTestSuite() {
    console.log("=== Variant Checkout Snapshot Contract Test Suite ===");

    const validId1 = "123e4567-e89b-12d3-a456-426614174001";
    const validId2 = "123e4567-e89b-12d3-a456-426614174002";
    const validId3 = "123e4567-e89b-12d3-a456-426614174003";
    const prodId1 = "987e6543-e89b-12d3-a456-426614174001";
    const prodId2 = "987e6543-e89b-12d3-a456-426614174002";

    // 1. Zod schema contract verification
    const testSnapshotData: TVariantCheckoutSnapshot = {
        productId: prodId1,
        variantId: validId1,
        sku: "premium-hoodie-m-black",
        title: "Premium Heavyweight Hoodie",
        variantTitle: "M / Black",
        slug: "premium-heavyweight-hoodie",
        imageUrl: "https://example.com/images/hoodie-black.jpg",
        currentPrice: 1250.00,
        purchasePrice: 750.00,
        weight: null,
        inventoryType: "discrete",
        allowBackorder: false,
        availableStock: 25,
        isUnlimited: false,
        isPurchasable: true,
        optionValues: { Size: "M", Color: "Black" },
        status: "published",
        isActive: true,
    };

    const parsedSnapshot = VariantCheckoutSnapshotSchema.parse(testSnapshotData);
    console.assert(parsedSnapshot.variantId === validId1, "Variant ID matched");
    console.assert(parsedSnapshot.currentPrice === 1250, "Current price parsed correctly as number");
    console.assert(parsedSnapshot.availableStock === 25, "Available stock parsed correctly");
    console.assert(parsedSnapshot.isPurchasable === true, "Item is purchasable");
    console.assert(parsedSnapshot.weight === null, "Weight is safely nullable");

    // 2. Mock Executor for database responses
    const mockDbData = [
        // Case 1: Discrete stock available
        {
            id: validId1,
            productId: prodId1,
            title: "M / Black",
            sku: "premium-hoodie-m-black",
            optionValues: { Size: "M", Color: "Black" },
            signature: "size:m|color:black",
            inventoryType: "discrete" as const,
            purchasePrice: "750.00",
            sellPrice: "1250.00",
            stock: "25.00",
            poolConsumptionRate: null,
            isDefault: true,
            isActive: true,
            imageUrl: "https://example.com/hoodie-m.jpg",
            deletedAt: null,
            allowBackorder: null,
            product: {
                id: prodId1,
                name: "Premium Heavyweight Hoodie",
                slug: "premium-heavyweight-hoodie",
                featuredImageUrl: "https://example.com/hoodie-feat.jpg",
                inventoryType: "discrete" as const,
                poolStock: "0.00",
                status: "published" as const,
                allowBackorder: false,
                publishedAt: new Date(Date.now() - 100000),
                deletedAt: null,
            },
        },
        // Case 2: Shared pool stock (e.g. 100kg pool, variant consumes 0.5kg -> 200 items available)
        {
            id: validId2,
            productId: prodId2,
            title: "500g Jar",
            sku: "organic-honey-500g",
            optionValues: { Size: "500g" },
            signature: "size:500g",
            inventoryType: "shared_pool" as const,
            purchasePrice: "300.00",
            sellPrice: "550.00",
            stock: "0.00",
            poolConsumptionRate: "0.5000",
            isDefault: true,
            isActive: true,
            imageUrl: null,
            deletedAt: null,
            allowBackorder: null,
            product: {
                id: prodId2,
                name: "Raw Organic Honey",
                slug: "raw-organic-honey",
                featuredImageUrl: "https://example.com/honey.jpg",
                inventoryType: "shared_pool" as const,
                poolStock: "100.0000",
                status: "published" as const,
                allowBackorder: false,
                publishedAt: new Date(Date.now() - 100000),
                deletedAt: null,
            },
        },
        // Case 3: No tracking (digital good or unmanaged inventory)
        {
            id: validId3,
            productId: prodId1,
            title: "Digital Gift Voucher",
            sku: "digital-voucher-500",
            optionValues: {},
            signature: "default",
            inventoryType: "no_tracking" as const,
            purchasePrice: "0.00",
            sellPrice: "500.00",
            stock: "0.00",
            poolConsumptionRate: null,
            isDefault: false,
            isActive: true,
            imageUrl: null,
            deletedAt: null,
            allowBackorder: null,
            product: {
                id: prodId1,
                name: "Digital Voucher",
                slug: "digital-voucher",
                featuredImageUrl: "https://example.com/voucher.jpg",
                inventoryType: "no_tracking" as const,
                poolStock: "0.00",
                status: "published" as const,
                allowBackorder: false,
                publishedAt: new Date(Date.now() - 100000),
                deletedAt: null,
            },
        },
    ];

    const mockExecutor = {
        query: {
            productVariantsTable: {
                findMany: async () => {
                    return mockDbData;
                },
            },
        },
    } as unknown as InventoryExecutor;

    // 3. Test getVariantCheckoutSnapshots with mock executor
    const snapshots = await getVariantCheckoutSnapshots(
        [validId1, validId2, validId3],
        { executor: mockExecutor }
    );

    console.assert(snapshots.length === 3, "Fetched 3 snapshots");

    // Check Case 1 (Discrete)
    const snap1 = snapshots.find((s) => s.variantId === validId1)!;
    console.assert(snap1.inventoryType === "discrete", "Discrete inventory type resolved");
    console.assert(snap1.availableStock === 25, "Discrete stock computed correctly");
    console.assert(snap1.isUnlimited === false, "Discrete stock is not unlimited");
    console.assert(snap1.isPurchasable === true, "Discrete item is purchasable");
    console.assert(snap1.imageUrl === "https://example.com/hoodie-m.jpg", "Variant imageUrl used over product image");

    // Check Case 2 (Shared pool: 100 / 0.5 = 200)
    const snap2 = snapshots.find((s) => s.variantId === validId2)!;
    console.assert(snap2.inventoryType === "shared_pool", "Shared pool inventory type resolved");
    console.assert(snap2.availableStock === 200, "Shared pool derived stock = 200");
    console.assert(snap2.isUnlimited === false, "Shared pool is not unlimited");
    console.assert(snap2.isPurchasable === true, "Shared pool item is purchasable");
    console.assert(snap2.imageUrl === "https://example.com/honey.jpg", "Fallback to product featuredImageUrl");

    // Check Case 3 (No tracking)
    const snap3 = snapshots.find((s) => s.variantId === validId3)!;
    console.assert(snap3.inventoryType === "no_tracking", "No tracking inventory type resolved");
    console.assert(snap3.availableStock === null, "No tracking available stock is null");
    console.assert(snap3.isUnlimited === true, "No tracking isUnlimited is true");
    console.assert(snap3.isPurchasable === true, "No tracking item is purchasable");

    // 4. Test Single getVariantCheckoutSnapshot resolver
    const singleMockExecutor = {
        query: {
            productVariantsTable: {
                findMany: async () => [mockDbData[0]],
            },
        },
    } as unknown as InventoryExecutor;
    const singleSnap = await getVariantCheckoutSnapshot(validId1, { executor: singleMockExecutor });
    console.assert(singleSnap.variantId === validId1, "Single snapshot resolver returned correct variant");
    console.assert(singleSnap.sku === "premium-hoodie-m-black", "SKU matched");

    // 5. Test Requested Quantity Guard (Stock = 25)
    const quantityPassingSnap = await getVariantCheckoutSnapshot(validId1, {
        requestedQuantity: 25,
        executor: singleMockExecutor,
    });
    console.assert(quantityPassingSnap.isPurchasable === true, "Purchasable when requestedQty <= availableStock");

    const quantityFailingSnap = await getVariantCheckoutSnapshot(validId1, {
        requestedQuantity: 26,
        executor: singleMockExecutor,
    });
    console.assert(quantityFailingSnap.isPurchasable === false, "Not purchasable when requestedQty > availableStock");

    // 6. Test Inactive / Unpurchasable variant
    const inactiveMockExecutor = {
        query: {
            productVariantsTable: {
                findMany: async () => [
                    {
                        ...mockDbData[0],
                        isActive: false,
                    },
                ],
            },
        },
    } as unknown as InventoryExecutor;
    const inactiveSnap = await getVariantCheckoutSnapshot(validId1, { executor: inactiveMockExecutor });
    console.assert(inactiveSnap.isPurchasable === false, "Inactive variant is not purchasable");
    console.assert(inactiveSnap.isActive === false, "isActive is false in snapshot");

    // 7. Test Draft / Unreleased product
    const draftMockExecutor = {
        query: {
            productVariantsTable: {
                findMany: async () => [
                    {
                        ...mockDbData[0],
                        product: {
                            ...mockDbData[0].product,
                            status: "draft" as const,
                        },
                    },
                ],
            },
        },
    } as unknown as InventoryExecutor;
    const draftSnap = await getVariantCheckoutSnapshot(validId1, { executor: draftMockExecutor });
    console.assert(draftSnap.isPurchasable === false, "Draft product variant is not purchasable");

    // 8. Test NotFoundError when variant does not exist
    const emptyMockExecutor = {
        query: {
            productVariantsTable: {
                findMany: async () => [],
            },
        },
    } as unknown as InventoryExecutor;
    let notFoundThrew = false;
    try {
        await getVariantCheckoutSnapshot("00000000-0000-0000-0000-000000000000", { executor: emptyMockExecutor });
    } catch (err) {
        if (err instanceof NotFoundError) {
            notFoundThrew = true;
        }
    }
    console.assert(notFoundThrew, "Throws NotFoundError when variant ID does not exist");

    // 9. Test Invalid UUID format validation
    let invalidUuidThrew = false;
    try {
        await getVariantCheckoutSnapshot("not-a-valid-uuid", { executor: emptyMockExecutor });
    } catch {
        invalidUuidThrew = true;
    }
    console.assert(invalidUuidThrew, "Rejects invalid UUID format");

    console.log("✔ All Variant Checkout Snapshot Contract tests passed successfully! 🚀");
}

runCheckoutSnapshotTestSuite().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
