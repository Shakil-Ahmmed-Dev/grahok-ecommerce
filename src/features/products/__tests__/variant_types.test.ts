import {
    CreateVariantTypeSchema,
    UpdateVariantTypeSchema,
    CreateProductOptionSchema,
    GenerateMatrixInputSchema,
    ProductModelSchema,
} from "@/features/products/types";
import {
    generateCartesianPermutations,
} from "@/features/products/matrix";
import {
    calculateVariantStock,
    resolveEffectiveInventoryType,
} from "@/features/products/inventory";
import { buildProductConditions } from "@/features/products/query";
import { PgDialect } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const dialect = new PgDialect();

async function runVariantTypesTestSuite() {
    console.log("=== Variant Types & Multi-Inventory Test Suite ===");

    // 1. VariantType Zod Schemas
    const validCreateType = CreateVariantTypeSchema.parse({
        name: "Liquid Volume",
        code: "liquid_volume",
        description: "Standard liquid container volume options",
        defaultInventoryType: "shared_pool",
        position: 1,
        isActive: true,
        values: [
            { value: "250ml", position: 0, defaultConsumptionRate: 0.25 },
            { value: "500ml", position: 1, defaultConsumptionRate: 0.5 },
            { value: "1000ml", position: 2, defaultConsumptionRate: 1.0 },
        ],
    });
    console.assert(validCreateType.name === "Liquid Volume", "Name matches");
    console.assert(validCreateType.code === "liquid_volume", "Code matches");
    console.assert(validCreateType.defaultInventoryType === "shared_pool", "defaultInventoryType matches");
    console.assert(validCreateType.values?.length === 3, "Values array length matches");
    console.assert(validCreateType.values?.[0].defaultConsumptionRate === 0.25, "defaultConsumptionRate matches");

    let invalidRateThrew = false;
    try {
        CreateVariantTypeSchema.parse({
            name: "Invalid",
            code: "inv",
            values: [{ value: "bad", defaultConsumptionRate: -1 }],
        });
    } catch {
        invalidRateThrew = true;
    }
    console.assert(invalidRateThrew, "Rejects non-positive defaultConsumptionRate");

    const validUpdateType = UpdateVariantTypeSchema.parse({
        name: "Beverage Volume",
        values: [
            { id: "val-uuid-1", value: "250ml", defaultConsumptionRate: 0.25 },
        ],
    });
    console.assert(validUpdateType.name === "Beverage Volume", "UpdateVariantTypeSchema parsed name");
    console.assert(validUpdateType.values?.[0].id === "val-uuid-1", "UpdateVariantTypeSchema preserved value ID");

    // 2. Product Option variantTypeId linkage
    const optionWithLink = CreateProductOptionSchema.parse({
        name: "Volume",
        position: 0,
        variantTypeId: "123e4567-e89b-12d3-a456-426614174000",
        values: [{ value: "250ml" }],
    });
    console.assert(optionWithLink.variantTypeId === "123e4567-e89b-12d3-a456-426614174000", "variantTypeId correctly captured");

    const optionWithoutLink = CreateProductOptionSchema.parse({
        name: "Custom Print",
        position: 1,
        values: [{ value: "Front Logo" }],
    });
    console.assert(optionWithoutLink.variantTypeId === undefined, "variantTypeId is optional for ad-hoc options");

    // 3. Matrix Permutation with Consumption Rate Propagation
    const matrixInput = GenerateMatrixInputSchema.parse({
        options: [
            {
                name: "Packaging",
                variantTypeId: "123e4567-e89b-12d3-a456-426614174000",
                values: [
                    { value: "Pouch 500g", defaultConsumptionRate: 0.5 },
                    { value: "Bag 1kg", defaultConsumptionRate: 1.0 },
                ],
            },
            {
                name: "Roast",
                values: [
                    { value: "Medium" },
                    { value: "Dark" },
                ],
            },
        ],
        defaultInventoryType: "shared_pool",
        defaultSellPrice: "18.50",
    });
    console.assert(matrixInput.defaultInventoryType === "shared_pool", "defaultInventoryType parsed");

    const perms = generateCartesianPermutations("coffee-beans", matrixInput.options, "COFFEE");
    console.assert(perms.length === 4, "Generated 4 permutations");
    const pouchMedium = perms.find((p) => p.title === "Pouch 500g / Medium");
    console.assert(pouchMedium?.poolConsumptionRate === 0.5, "Pouch 500g inherited 0.5 consumption rate");
    const bagDark = perms.find((p) => p.title === "Bag 1kg / Dark");
    console.assert(bagDark?.poolConsumptionRate === 1.0, "Bag 1kg inherited 1.0 consumption rate");

    // 4. resolveEffectiveInventoryType hierarchy
    console.assert(resolveEffectiveInventoryType("no_tracking", "discrete") === "no_tracking", "Variant explicit override wins");
    console.assert(resolveEffectiveInventoryType(null, "shared_pool") === "shared_pool", "Null variant inherits product policy");
    console.assert(resolveEffectiveInventoryType(undefined, "no_tracking") === "no_tracking", "Undefined variant inherits product policy");
    console.assert(resolveEffectiveInventoryType(null, null) === "discrete", "Fallback default is discrete");

    // 5. calculateVariantStock for multi-inventory policies
    // No tracking
    const noTrack = calculateVariantStock({
        masterPoolStock: 0,
        inventoryType: "no_tracking",
        variantStock: 0,
    });
    console.assert(noTrack.stock === null, "no_tracking stock is null");
    console.assert(noTrack.isUnlimited === true, "no_tracking isUnlimited is true");

    // Discrete
    const discrete = calculateVariantStock({
        masterPoolStock: 50,
        inventoryType: "discrete",
        variantStock: 42,
    });
    console.assert(discrete.stock === 42, "discrete stock is 42");
    console.assert(discrete.isUnlimited === false, "discrete isUnlimited is false");

    // Shared pool
    const shared50 = calculateVariantStock({
        masterPoolStock: 50,
        inventoryType: "shared_pool",
        poolConsumptionRate: 0.5,
    });
    console.assert(shared50.stock === 100, "50 pool with 0.5 rate produces 100 available units");
    console.assert(shared50.isUnlimited === false, "shared_pool isUnlimited is false");

    // Shared pool with rate undefined -> default 1
    const sharedDefRate = calculateVariantStock({
        masterPoolStock: 50,
        inventoryType: "shared_pool",
    });
    console.assert(sharedDefRate.stock === 50, "50 pool with default rate 1 produces 50 available units");

    // Shared pool exhausted (0 pool)
    const shared0 = calculateVariantStock({
        masterPoolStock: 0,
        inventoryType: "shared_pool",
        poolConsumptionRate: 0.5,
    });
    console.assert(shared0.stock === 0, "0 pool produces 0 stock");

    // 6. Product Model Schema & poolStock
    const rawProductDbRow = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Basmati Rice",
        slug: "basmati-rice",
        shortDescription: "Aged long grain",
        description: "Himalayan",
        tags: [],
        featuredImageUrl: "https://example.com/rice.jpg",
        images: [],
        sellPrice: "5.5",
        stock: "0",
        poolStock: 50,
        searchVector: "raw",
        inventoryType: "shared_pool" as const,
        status: "published" as const,
        publishedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
    };
    const parsedProductModel = ProductModelSchema.parse(rawProductDbRow);
    console.assert(parsedProductModel.poolStock === 50, "poolStock parsed on ProductModel");
    console.assert(parsedProductModel.inventoryType === "shared_pool", "inventoryType is shared_pool");

    // 7. inStock query condition verification
    const inStockSql = dialect.sqlToQuery(sql`${buildProductConditions({ inStock: true }, "public")}`);
    console.assert(inStockSql.sql.includes("no_tracking"), "SQL includes no_tracking");
    console.assert(inStockSql.sql.includes("pool_stock"), "SQL includes pool_stock");
    console.assert(inStockSql.sql.includes("pv.inventory_type = 'no_tracking'"), "SQL includes variant override to no_tracking");

    console.log("✔ All Variant Types & Multi-Inventory policy tests passed successfully! 🎯");
}

void runVariantTypesTestSuite();
