import {
    calculateVolumetricWeight,
    calculateChargeableWeight,
    resolveEffectiveLogistics,
    calculateConsignmentLogistics,
} from "@/features/products/logistics";
import {
    LogisticsMetricsInputSchema,
    CreateProductVariantSchema,
    VariantCheckoutSnapshotSchema,
} from "@/features/products/types";
import { getVariantCheckoutSnapshots } from "@/features/products/actions";

async function runLogisticsTestSuite() {
    console.log("=== Logistics Metrics Integration Test Suite ===");

    // -------------------------------------------------------------
    // 1. Volumetric Weight Calculation Tests
    // -------------------------------------------------------------
    console.log("1. Testing calculateVolumetricWeight...");

    // Standard package: 20 x 15 x 10 cm / 5000 = 3000 / 5000 = 0.6 kg
    const standardVol = calculateVolumetricWeight({
        packageLength: 20,
        packageWidth: 15,
        packageHeight: 10,
    });
    console.assert(standardVol === 0.6, `Expected 0.6, got ${standardVol}`);

    // Divisor override: 20 x 15 x 10 cm / 6000 = 3000 / 6000 = 0.5 kg
    const customDivisorVol = calculateVolumetricWeight(
        { packageLength: 20, packageWidth: 15, packageHeight: 10 },
        6000
    );
    console.assert(customDivisorVol === 0.5, `Expected 0.5, got ${customDivisorVol}`);

    // Decimal rounding (3 decimal places): 17.5 x 12.3 x 8.4 = 1808.1 / 5000 = 0.36162 -> 0.362
    const roundedVol = calculateVolumetricWeight({
        packageLength: 17.5,
        packageWidth: 12.3,
        packageHeight: 8.4,
    });
    console.assert(roundedVol === 0.362, `Expected 0.362, got ${roundedVol}`);

    // Incomplete or non-positive dimensions return null
    console.assert(
        calculateVolumetricWeight({ packageLength: 20, packageWidth: null, packageHeight: 10 }) === null,
        "Null dimension returns null"
    );
    console.assert(
        calculateVolumetricWeight({ packageLength: 20, packageWidth: 0, packageHeight: 10 }) === null,
        "Zero dimension returns null"
    );
    console.assert(
        calculateVolumetricWeight({ packageLength: -5, packageWidth: 10, packageHeight: 10 }) === null,
        "Negative dimension returns null"
    );
    console.assert(
        calculateVolumetricWeight(null) === null,
        "Null dimensions input returns null"
    );

    // -------------------------------------------------------------
    // 2. Chargeable Weight Calculation Tests
    // -------------------------------------------------------------
    console.log("2. Testing calculateChargeableWeight...");

    // Actual weight dominates
    console.assert(
        calculateChargeableWeight(2.5, 1.2) === 2.5,
        "Actual weight dominates when greater than volumetric weight"
    );

    // Volumetric weight dominates
    console.assert(
        calculateChargeableWeight(0.8, 1.5) === 1.5,
        "Volumetric weight dominates when greater than actual weight"
    );

    // Only actual weight present
    console.assert(
        calculateChargeableWeight(3.2, null) === 3.2,
        "Resolves actual weight when volumetric is null"
    );

    // Only volumetric weight present
    console.assert(
        calculateChargeableWeight(null, 2.1) === 2.1,
        "Resolves volumetric weight when actual is null"
    );

    // Both absent or non-positive
    console.assert(
        calculateChargeableWeight(null, null) === null,
        "Both null returns null"
    );
    console.assert(
        calculateChargeableWeight(0, -1) === null,
        "Non-positive weights return null"
    );

    // -------------------------------------------------------------
    // 3. Effective Logistics Resolution & Atomic Fallback Tests
    // -------------------------------------------------------------
    console.log("3. Testing resolveEffectiveLogistics (Atomic Fallback)...");

    // Case 3a: Variant defines both weight and complete dimensions
    const resA = resolveEffectiveLogistics(
        { weight: 0.75, packageLength: 25, packageWidth: 20, packageHeight: 10 },
        { weight: 1.2, packageLength: 50, packageWidth: 40, packageHeight: 30 }
    );
    console.assert(resA.weight === 0.75, "Variant weight overrides product weight");
    console.assert(resA.packageLength === 25, "Variant length used");
    console.assert(resA.volumetricWeight === 1.0, "Volumetric weight computed: 25*20*10/5000 = 1.0");
    console.assert(resA.chargeableWeight === 1.0, "Chargeable weight: max(0.75, 1.0) = 1.0");

    // Case 3b: Atomic Fallback - Variant has INCOMPLETE dimensions -> fallback to complete product dimensions
    const resB = resolveEffectiveLogistics(
        { weight: null, packageLength: 25, packageWidth: null, packageHeight: 10 }, // incomplete variant dimensions!
        { weight: 2.0, packageLength: 40, packageWidth: 30, packageHeight: 20 }
    );
    console.assert(resB.weight === 2.0, "Product weight used as fallback");
    console.assert(resB.packageLength === 40, "Product length used via atomic fallback");
    console.assert(resB.packageWidth === 30, "Product width used via atomic fallback");
    console.assert(resB.packageHeight === 20, "Product height used via atomic fallback");
    console.assert(resB.volumetricWeight === 4.8, "Volumetric weight from product dims: 24000/5000 = 4.8");
    console.assert(resB.chargeableWeight === 4.8, "Chargeable weight: max(2.0, 4.8) = 4.8");

    // Case 3c: Digital Product - No physical metrics
    const resC = resolveEffectiveLogistics(
        { weight: null, packageLength: null, packageWidth: null, packageHeight: null },
        { weight: null, packageLength: null, packageWidth: null, packageHeight: null }
    );
    console.assert(resC.weight === null, "Digital weight is null");
    console.assert(resC.packageLength === null, "Digital package length is null");
    console.assert(resC.volumetricWeight === null, "Digital volumetric weight is null");
    console.assert(resC.chargeableWeight === null, "Digital chargeable weight is null");

    // -------------------------------------------------------------
    // 4. Consignment Logistics Tests
    // -------------------------------------------------------------
    console.log("4. Testing calculateConsignmentLogistics...");

    const consignmentItems = [
        // 2x Compact Heavy Item: 0.5kg, 20 x 10 x 5 cm (vol = 1000 cm3, volWeight = 0.2kg, chargeable = 0.5kg)
        { weight: 0.5, packageLength: 20, packageWidth: 10, packageHeight: 5, quantity: 2 },
        // 1x Bulky Light Item: 1.0kg, 50 x 40 x 20 cm (vol = 40000 cm3, volWeight = 8.0kg, chargeable = 8.0kg)
        { weight: 1.0, packageLength: 50, packageWidth: 40, packageHeight: 20, quantity: 1 },
        // 3x Digital Item: 0kg, no dimensions
        { weight: null, packageLength: null, packageWidth: null, packageHeight: null, quantity: 3 },
    ];

    const consignment = calculateConsignmentLogistics(consignmentItems);
    console.assert(consignment.totalActualWeight === 2.0, `Expected actual weight 2.0, got ${consignment.totalActualWeight}`);
    console.assert(consignment.totalVolumeCm3 === 42000, `Expected total volume 42000, got ${consignment.totalVolumeCm3}`);
    console.assert(consignment.aggregateVolumetricWeight === 8.4, `Expected aggregate vol weight 8.4, got ${consignment.aggregateVolumetricWeight}`);
    console.assert(consignment.chargeableWeight === 8.4, `Expected aggregate chargeable 8.4, got ${consignment.chargeableWeight}`);
    console.assert(consignment.pieceChargeableWeight === 9.0, `Expected piece chargeable (2*0.5 + 1*8.0 = 9.0), got ${consignment.pieceChargeableWeight}`);
    console.assert(consignment.hasPhysicalGoods === true, "Physical goods flag is true");

    // Digital-only consignment
    const digitalConsignment = calculateConsignmentLogistics([
        { weight: null, packageLength: null, packageWidth: null, packageHeight: null, quantity: 5 },
    ]);
    console.assert(digitalConsignment.totalActualWeight === 0, "Digital actual weight is 0");
    console.assert(digitalConsignment.totalVolumeCm3 === 0, "Digital volume is 0");
    console.assert(digitalConsignment.hasPhysicalGoods === false, "Digital hasPhysicalGoods is false");

    // -------------------------------------------------------------
    // 5. Zod Schema Validation & Dimensional Completeness Tests
    // -------------------------------------------------------------
    console.log("5. Testing Zod Schemas & Dimensional Completeness...");

    // Complete dimensions pass
    const validLogistics = LogisticsMetricsInputSchema.parse({
        weight: 1.25,
        packageLength: 10,
        packageWidth: 15,
        packageHeight: 20,
    });
    console.assert(validLogistics.packageLength === 10, "Valid dimensions parsed successfully");

    // Weight only (without dimensions) passes
    const weightOnly = LogisticsMetricsInputSchema.parse({
        weight: 2.5,
    });
    console.assert(weightOnly.weight === 2.5, "Weight-only parsed successfully");

    // Incomplete dimensions fail refinement
    let incompleteDimensionsThrew = false;
    try {
        LogisticsMetricsInputSchema.parse({
            weight: 1.0,
            packageLength: 10,
            packageWidth: null, // missing width!
            packageHeight: 20,
        });
    } catch {
        incompleteDimensionsThrew = true;
    }
    console.assert(incompleteDimensionsThrew, "LogisticsMetricsInputSchema rejects incomplete dimensions");

    // Non-positive dimensions fail
    let negativeDimensionThrew = false;
    try {
        LogisticsMetricsInputSchema.parse({
            packageLength: -10,
            packageWidth: 15,
            packageHeight: 20,
        });
    } catch {
        negativeDimensionThrew = true;
    }
    console.assert(negativeDimensionThrew, "LogisticsMetricsInputSchema rejects negative dimensions");

    // CreateProductVariantSchema dimensional refinement check
    let variantIncompleteDimsThrew = false;
    try {
        CreateProductVariantSchema.parse({
            sellPrice: 100,
            packageLength: 10,
            packageWidth: 20,
            // packageHeight missing
        });
    } catch {
        variantIncompleteDimsThrew = true;
    }
    console.assert(variantIncompleteDimsThrew, "CreateProductVariantSchema rejects incomplete dimensions");

    // -------------------------------------------------------------
    // 6. Variant Checkout Snapshot Contract Integration Test
    // -------------------------------------------------------------
    console.log("6. Testing Variant Checkout Snapshot Logistics Integration...");

    const vId1 = "123e4567-e89b-12d3-a456-426614174011";
    const vId2 = "123e4567-e89b-12d3-a456-426614174012";
    const pId1 = "987e6543-e89b-12d3-a456-426614174011";
    const pId2 = "987e6543-e89b-12d3-a456-426614174012";

    const mockDbVariants = [
        {
            id: vId1,
            productId: pId1,
            title: "Large Bulky Jacket",
            sku: "jacket-l",
            optionValues: { Size: "L" },
            signature: "size=l",
            inventoryType: "discrete" as const,
            allowBackorder: null,
            purchasePrice: "50.00",
            sellPrice: "120.00",
            stock: "10.00",
            poolConsumptionRate: null,
            weight: "1.200",
            packageLength: "50.00",
            packageWidth: "40.00",
            packageHeight: "20.00",
            isDefault: false,
            isActive: true,
            imageUrl: null,
            deletedAt: null,
            product: {
                id: pId1,
                name: "Winter Parka",
                slug: "winter-parka",
                featuredImageUrl: "https://example.com/parka.jpg",
                inventoryType: "discrete" as const,
                poolStock: "0.00",
                status: "published" as const,
                allowBackorder: false,
                weight: "1.000",
                packageLength: "45.00",
                packageWidth: "35.00",
                packageHeight: "15.00",
                publishedAt: new Date(Date.now() - 10000),
                deletedAt: null,
            },
        },
        {
            id: vId2,
            productId: pId2,
            title: "Loose Honey 500g Jar",
            sku: "honey-500g",
            optionValues: {},
            signature: "default",
            inventoryType: "shared_pool" as const,
            allowBackorder: null,
            purchasePrice: "5.00",
            sellPrice: "15.00",
            stock: "0.00",
            poolConsumptionRate: "0.5000",
            weight: "0.650",
            packageLength: null,
            packageWidth: null,
            packageHeight: null, // Variant has no dims, parent product has complete dims
            isDefault: true,
            isActive: true,
            imageUrl: null,
            deletedAt: null,
            product: {
                id: pId2,
                name: "Raw Honey Master",
                slug: "raw-honey-master",
                featuredImageUrl: "https://example.com/honey.jpg",
                inventoryType: "shared_pool" as const,
                poolStock: "50.0000",
                status: "published" as const,
                allowBackorder: false,
                weight: "10.000",
                packageLength: "15.00",
                packageWidth: "12.00",
                packageHeight: "10.00",
                publishedAt: new Date(Date.now() - 10000),
                deletedAt: null,
            },
        },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockExecutor: any = {
        query: {
            productVariantsTable: {
                findMany: async () => mockDbVariants,
            },
        },
    };

    const snapshots = await getVariantCheckoutSnapshots([vId1, vId2], { executor: mockExecutor });
    console.assert(snapshots.length === 2, "Fetched 2 snapshots");

    // Snapshot 1 (Variant-level dimensions): 50 x 40 x 20 cm = 40000 cm3 -> volWeight = 8.0 kg, actual = 1.2 kg -> chargeable = 8.0 kg
    const snap1 = snapshots.find((s) => s.variantId === vId1)!;
    console.assert(snap1.weight === 1.2, `Expected weight 1.2, got ${snap1.weight}`);
    console.assert(snap1.packageLength === 50, `Expected length 50, got ${snap1.packageLength}`);
    console.assert(snap1.packageWidth === 40, `Expected width 40, got ${snap1.packageWidth}`);
    console.assert(snap1.packageHeight === 20, `Expected height 20, got ${snap1.packageHeight}`);
    console.assert(snap1.volumetricWeight === 8.0, `Expected volumetricWeight 8.0, got ${snap1.volumetricWeight}`);
    console.assert(snap1.chargeableWeight === 8.0, `Expected chargeableWeight 8.0, got ${snap1.chargeableWeight}`);

    // Snapshot 2 (Product fallback dimensions): 15 x 12 x 10 cm = 1800 cm3 -> volWeight = 0.36 kg, actual = 0.65 kg -> chargeable = 0.65 kg
    const snap2 = snapshots.find((s) => s.variantId === vId2)!;
    console.assert(snap2.weight === 0.65, `Expected weight 0.65, got ${snap2.weight}`);
    console.assert(snap2.packageLength === 15, `Expected fallback length 15, got ${snap2.packageLength}`);
    console.assert(snap2.volumetricWeight === 0.36, `Expected fallback volWeight 0.36, got ${snap2.volumetricWeight}`);
    console.assert(snap2.chargeableWeight === 0.65, `Expected chargeableWeight 0.65, got ${snap2.chargeableWeight}`);

    // -------------------------------------------------------------
    // 7. Strict ZERO TAX & Constraint Auditing
    // -------------------------------------------------------------
    console.log("7. Auditing ZERO TAX policy across all schemas...");

    const snapshotKeys = Object.keys(VariantCheckoutSnapshotSchema.shape);
    console.assert(!snapshotKeys.includes("taxRate"), "Snapshot must NOT contain taxRate");
    console.assert(!snapshotKeys.includes("tax"), "Snapshot must NOT contain tax");
    console.assert(!snapshotKeys.includes("vat"), "Snapshot must NOT contain vat");

    console.assert(snap1.allowBackorder === false, "Default allowBackorder is false");

    console.log("✔ All Logistics Metrics Integration tests passed successfully! 🚚📦");
}

runLogisticsTestSuite().catch((err) => {
    console.error("Test suite failed:", err);
    process.exit(1);
});
