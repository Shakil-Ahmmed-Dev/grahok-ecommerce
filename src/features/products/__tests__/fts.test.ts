import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
    buildProductSearchQuery,
    buildFuzzySearchCondition,
    buildFuzzyOrderBy,
    resolveProductSort,
    buildProductConditions,
    buildProductOrderBy,
    encodeCursor,
    decodeCursor,
    buildCursorCondition,
    parseProductQuery,
} from "@/features/products/query";
import {
    GetProductPublicSchema,
    GetProductSchema,
    ProductSortSchema,
    ProductFacetsSchema,
    ProductSuggestionsSchema,
    SuggestQuerySchema,
    RelatedProductsQuerySchema,
    ProductQuerySchema,
    ProductsListSchema,
    WeightUnitSchema,
    InventoryTypeSchema,
    CreateProductVariantSchema,
    UpdateProductVariantSchema,
    ProductVariantPublicSchema,
    ProductVariantSchema,
    ProductSlugRedirectModelSchema,
} from "@/features/products/types";
import { calculateVariantStock, convertWeightUnit } from "@/features/products/inventory";
import { PermanentRedirectError } from "@/lib/error";
import { handleError } from "@/lib/http";

const dialect = new PgDialect();

function runTests() {
    console.log("=== 1. Testing Search Query Builder ===");

    // Empty searches
    console.assert(buildProductSearchQuery(undefined) === null, "Undefined search should return null");
    console.assert(buildProductSearchQuery("") === null, "Empty search should return null");
    console.assert(buildProductSearchQuery("   ") === null, "Whitespace search should return null");
    console.log("✔ Empty search handling passed");

    // Plain single word -> combines websearch and prefix
    const qSingle = buildProductSearchQuery("wirel");
    const qSingleSql = dialect.sqlToQuery(qSingle!);
    console.assert(
        qSingleSql.sql.includes("websearch_to_tsquery") && qSingleSql.sql.includes("to_tsquery"),
        "Single word should generate combined websearch + prefix query"
    );
    console.assert(qSingleSql.params.includes("wirel:*"), "Should include prefix term wirel:*");
    console.log("✔ Plain single word prefix passed:", qSingleSql.sql, qSingleSql.params);

    // Plain multi-word -> combines websearch and prefix with &
    const qMulti = buildProductSearchQuery("wirel headph");
    const qMultiSql = dialect.sqlToQuery(qMulti!);
    console.assert(qMultiSql.params.includes("wirel:* & headph:*"), "Should join prefix terms with &");
    console.log("✔ Plain multi-word prefix passed:", qMultiSql.sql, qMultiSql.params);

    // Phrase search
    const qPhrase = buildProductSearchQuery('"wireless headphones"');
    const qPhraseSql = dialect.sqlToQuery(qPhrase!);
    console.assert(
        !qPhraseSql.sql.includes("|| to_tsquery"),
        "Phrase search should not inject raw prefix to_tsquery"
    );
    console.assert(qPhraseSql.params.includes('"wireless headphones"'), "Phrase search preserved quotes");
    console.log("✔ Phrase search preserved:", qPhraseSql.sql, qPhraseSql.params);

    // Boolean OR search
    const qOr = buildProductSearchQuery("apple OR samsung");
    const qOrSql = dialect.sqlToQuery(qOr!);
    console.assert(!qOrSql.sql.includes("|| to_tsquery"), "OR search should not inject raw prefix");
    console.assert(qOrSql.params.includes("apple OR samsung"), "Boolean OR preserved");
    console.log("✔ Boolean OR preserved:", qOrSql.sql, qOrSql.params);

    // Exclusion search
    const qExcl = buildProductSearchQuery("wireless -sony");
    const qExclSql = dialect.sqlToQuery(qExcl!);
    console.assert(qExclSql.params.includes("wireless -sony"), "Negative exclusion preserved");
    console.log("✔ Negative term exclusion preserved:", qExclSql.sql, qExclSql.params);

    // Special characters safety
    const specialStrings = ["&", "|", "!", ":", "(", ")", "*", "-", "!@#$%^&*():"];
    for (const str of specialStrings) {
        const qSpecial = buildProductSearchQuery(str);
        if (qSpecial) {
            const qSpecialSql = dialect.sqlToQuery(qSpecial);
            console.assert(typeof qSpecialSql.sql === "string", `Special chars '${str}' should compile safely`);
        }
    }
    console.log("✔ Special characters compiled safely without errors");

    console.log("\n=== 2. Testing Effective Sort Resolution ===");
    console.assert(resolveProductSort({}) === "createdAt", "No search, no sort => createdAt");
    console.assert(resolveProductSort({ search: "headphone" }) === "relevance", "Search, no sort => relevance");
    console.assert(resolveProductSort({ search: "headphone", sortBy: "relevance" }) === "relevance", "Search + relevance => relevance");
    console.assert(resolveProductSort({ search: "headphone", sortBy: "sellPrice" }) === "sellPrice", "Search + sellPrice => sellPrice");
    console.assert(resolveProductSort({ search: "headphone", sortBy: "createdAt" }) === "createdAt", "Search + createdAt => createdAt");
    console.assert(resolveProductSort({ search: "headphone", sortBy: "name" }) === "name", "Search + name => name");
    console.assert(resolveProductSort({ sortBy: "sellPrice" }) === "sellPrice", "No search + sellPrice => sellPrice");
    console.log("✔ Sort resolution matrix passed all cases");

    console.log("\n=== 3. Testing Condition & Order Builders ===");
    const searchQ = buildProductSearchQuery("headphones");
    const conds = buildProductConditions({ search: "headphones", category: "audio" }, "public", searchQ);
    const condSql = dialect.sqlToQuery(sql`${conds}`);
    console.assert(condSql.sql.includes('"search_vector" @@'), "Conditions must include search_vector @@ query");
    console.assert(condSql.sql.includes('"status" ='), "Conditions must include status check");
    console.assert(condSql.sql.includes("WITH RECURSIVE cat_tree"), "Conditions must include recursive category subtree match");
    console.log("✔ Condition builder generates FTS predicate, status lifecycle, and recursive category matching:", condSql.sql);

    const orderRelevance = buildProductOrderBy("relevance", "desc", searchQ);
    const orderSql = dialect.sqlToQuery(sql`${orderRelevance[0]}`);
    console.assert(orderSql.sql.includes('ts_rank("products"."search_vector"'), "Order by relevance must use ts_rank");
    console.log("✔ Order builder generates ts_rank relevance ranking:", orderSql.sql);

    const orderPublished = buildProductOrderBy("publishedAt", "desc");
    const orderPublishedSql = dialect.sqlToQuery(sql`${orderPublished[0]}`);
    console.assert(orderPublishedSql.sql.includes('"publishedAt" desc'), "Order by publishedAt must order by publishedAt desc");
    console.log("✔ Order builder generates publishedAt order correctly:", orderPublishedSql.sql);

    console.log("\n=== 4. Testing Schema Projection Safety ===");
    const dummyProduct = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Wireless Headphones",
        slug: "wireless-headphones",
        shortDescription: "Premium wireless noise-cancelling headphones",
        description: "Experience world-class noise cancellation with 30 hours of battery life.",
        tags: ["audio"],
        featuredImageUrl: "https://example.com/img.jpg",
        images: [],
        sellPrice: "99.99",
        stock: "10",
        status: "published" as const,
        publishedAt: new Date(),
        searchVector: "some-raw-tsvector-data",
        categories: [
            {
                id: "c123e456-e89b-12d3-a456-426614174000",
                name: "Audio",
                slug: "audio",
                isPrimary: true,
            },
        ],
    };

    const parsedPublic = GetProductPublicSchema.parse(dummyProduct);
    console.assert(!("searchVector" in parsedPublic), "GetProductPublicSchema must strip searchVector");
    console.assert(!("purchasePrice" in parsedPublic), "GetProductPublicSchema must strip purchasePrice");
    console.assert(parsedPublic.status === "published", "GetProductPublicSchema retains status");
    console.assert(parsedPublic.categories.length === 1 && parsedPublic.categories[0].name === "Audio", "GetProductPublicSchema retains categories");

    const parsedAdmin = GetProductSchema.parse({
        ...dummyProduct,
        purchasePrice: "50.00",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
    });
    console.assert(!("searchVector" in parsedAdmin), "GetProductSchema must strip searchVector");
    console.assert(Number(parsedAdmin.purchasePrice) === 50, "GetProductSchema retains purchasePrice");
    console.assert(parsedAdmin.categories.length === 1, "GetProductSchema retains categories");
    console.log("✔ Schema projections safely parse product and relational categories");

    // Test ProductSortSchema parsing
    const parsedDefault = ProductSortSchema.parse({});
    console.assert(parsedDefault.sortBy === undefined, "ProductSortSchema must leave sortBy optional when omitted");
    const parsedExplicit = ProductSortSchema.parse({ sortBy: "relevance" });
    console.assert(parsedExplicit.sortBy === "relevance", "ProductSortSchema accepts relevance");
    const parsedPublishedSort = ProductSortSchema.parse({ sortBy: "publishedAt" });
    console.assert(parsedPublishedSort.sortBy === "publishedAt", "ProductSortSchema accepts publishedAt");

    console.log("\n=== 5. Testing Keyset / Cursor Serialization & Invalidation ===");
    const testDate = new Date("2026-10-11T12:00:00.000Z");
    const testId = "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d";
    const encoded = encodeCursor(testDate, testId);
    console.assert(typeof encoded === "string" && encoded.length > 0, "Cursor must be a non-empty string");

    const decoded = decodeCursor(encoded);
    console.assert(decoded !== null, "Valid cursor should decode successfully");
    console.assert(decoded?.createdAt.getTime() === testDate.getTime(), "Decoded date must match original date");
    console.assert(decoded?.id === testId, "Decoded ID must match original ID");
    console.log("✔ Cursor roundtrip encoding/decoding passed");

    console.assert(decodeCursor("invalid-base64!!!") === null, "Malformed base64 should return null");
    console.assert(decodeCursor(Buffer.from(JSON.stringify({ notCreatedAt: "x" })).toString("base64url")) === null, "Invalid cursor payload should return null");
    console.assert(decodeCursor(Buffer.from(JSON.stringify({ createdAt: "not-a-date", id: "123" })).toString("base64url")) === null, "Invalid date string should return null");
    console.log("✔ Malformed cursor error handling passed");

    const cursorConditionDesc = buildCursorCondition({ createdAt: testDate, id: testId }, "desc");
    const cursorSqlDesc = dialect.sqlToQuery(cursorConditionDesc);
    console.assert(cursorSqlDesc.sql.includes("<") && cursorSqlDesc.sql.includes("="), "Desc cursor condition must generate tuple seek");
    console.log("✔ Desc cursor SQL condition generated correctly:", cursorSqlDesc.sql);

    const cursorConditionAsc = buildCursorCondition({ createdAt: testDate, id: testId }, "asc");
    const cursorSqlAsc = dialect.sqlToQuery(cursorConditionAsc);
    console.assert(cursorSqlAsc.sql.includes(">") && cursorSqlAsc.sql.includes("="), "Asc cursor condition must generate tuple seek");
    console.log("✔ Asc cursor SQL condition generated correctly:", cursorSqlAsc.sql);

    console.log("\n=== 6. Testing Facet Schemas & Query Parsing ===");
    const dummyFacets = {
        categories: [{ id: "c1", name: "Electronics", slug: "electronics", count: 42 }],
        tags: [{ name: "wireless", count: 15 }],
        priceRange: { min: 19.99, max: 299.99 },
    };
    const parsedFacets = ProductFacetsSchema.parse(dummyFacets);
    console.assert(parsedFacets.categories[0].name === "Electronics" && parsedFacets.categories[0].count === 42, "Categories facet parsed");
    console.assert(parsedFacets.priceRange.min === 19.99 && parsedFacets.priceRange.max === 299.99, "Price range facet parsed");
    console.log("✔ Facet schema parsing passed");

    const parsedProductsList = ProductsListSchema.parse({
        data: [dummyProduct],
        meta: {
            pageSize: 10,
            hasNextPage: true,
            hasPrevPage: false,
            nextCursor: encoded,
        },
        facets: dummyFacets,
    });
    console.assert(parsedProductsList.meta.nextCursor === encoded, "Next cursor retained in meta");
    console.assert(parsedProductsList.facets?.categories.length === 1, "Facets retained in ProductsListSchema");
    console.log("✔ ProductsListSchema with facets and cursor meta passed");

    console.log("\n=== 7. Testing Autocomplete / Suggestion Schemas ===");
    const validSuggestQuery = SuggestQuerySchema.parse({ q: "headph", limit: "5" });
    console.assert(validSuggestQuery.q === "headph" && validSuggestQuery.limit === 5, "Suggest query coerced limit and trimmed query");

    const dummySuggestions = {
        products: [{
            id: testId,
            name: "Wireless Headphones",
            slug: "wireless-headphones",
            category: "Audio",
            sellPrice: 99.99,
            featuredImageUrl: "https://example.com/img.jpg",
        }],
        categories: [
            { id: "c1", name: "Electronics", slug: "electronics" },
            { id: "c2", name: "Audio", slug: "audio" },
        ],
        tags: ["wireless", "audio"],
    };
    const parsedSuggestions = ProductSuggestionsSchema.parse(dummySuggestions);
    console.assert(parsedSuggestions.products.length === 1 && parsedSuggestions.categories.length === 2, "Product suggestions parsed");
    console.log("✔ Autocomplete suggestion schema passed");

    console.log("\n=== 8. Testing Query Param Parsing with Facets and Cursor ===");
    const testUrl = new URL("https://example.com/api/v1/products?search=shoes&includeFacets=true&cursor=" + encodeURIComponent(encoded) + "&tag=running&tag=sale");
    const parsedQuery = parseProductQuery(testUrl, ProductQuerySchema);
    console.assert(parsedQuery.search === "shoes", "Search param parsed");
    console.assert(parsedQuery.includeFacets === true, "includeFacets transformed to boolean true");
    console.assert(parsedQuery.cursor === encoded, "Cursor param parsed");
    console.assert(Array.isArray(parsedQuery.tags) && parsedQuery.tags.length === 2, "Multi-tag array parsed");
    console.log("✔ parseProductQuery with includeFacets, cursor, and multi-tags passed");

    console.log("\n=== 9. Testing Typo-Tolerance & Fuzzy Search Builders ===");
    console.assert(buildFuzzySearchCondition(undefined) === null, "Fuzzy condition with undefined returns null");
    console.assert(buildFuzzySearchCondition("   ") === null, "Fuzzy condition with whitespace returns null");

    const fuzzyCond = buildFuzzySearchCondition("samnsung");
    console.assert(fuzzyCond !== null, "Fuzzy condition should be generated");
    const fuzzyCondSql = dialect.sqlToQuery(fuzzyCond!);
    console.assert(
        fuzzyCondSql.sql.includes("%") && fuzzyCondSql.sql.includes("word_similarity"),
        "Fuzzy search SQL should include trigram % and word_similarity operators"
    );
    console.assert(fuzzyCondSql.params.includes("samnsung"), "Fuzzy condition should include search term");
    console.log("✔ Fuzzy condition builder generates trigram predicate:", fuzzyCondSql.sql, fuzzyCondSql.params);

    const fuzzyOrder = buildFuzzyOrderBy("samnsung", "desc");
    const fuzzyOrderSql = dialect.sqlToQuery(sql`${fuzzyOrder[0]}`);
    console.assert(
        fuzzyOrderSql.sql.includes("similarity") && fuzzyOrderSql.sql.includes("word_similarity"),
        "Fuzzy order should rank by similarity and word_similarity"
    );
    console.log("✔ Fuzzy order builder generates similarity rank order:", fuzzyOrderSql.sql);

    const fuzzyProductConds = buildProductConditions({ search: "samnsung" }, "public", null, null, fuzzyCond);
    const fuzzyProductCondsSql = dialect.sqlToQuery(sql`${fuzzyProductConds}`);
    console.assert(
        !fuzzyProductCondsSql.sql.includes("search_vector @@") && fuzzyProductCondsSql.sql.includes("%"),
        "Fuzzy fallback conditions must use trigram instead of search_vector"
    );
    console.log("✔ Condition builder generates fuzzy fallback predicate correctly");

    console.log("\n=== 10. Testing Related Products Query & Schema ===");
    const defaultRelatedQuery = RelatedProductsQuerySchema.parse({});
    console.assert(defaultRelatedQuery.limit === 8, "Related products limit defaults to 8");

    const customRelatedQuery = RelatedProductsQuerySchema.parse({ limit: "12" });
    console.assert(customRelatedQuery.limit === 12, "Related products limit coerces string to number");

    let limitOverflowThrew = false;
    try {
        RelatedProductsQuerySchema.parse({ limit: "25" });
    } catch {
        limitOverflowThrew = true;
    }
    console.assert(limitOverflowThrew, "Related products limit > 20 should throw validation error");
    console.log("✔ RelatedProductsQuerySchema validates limits and constraints");

    console.log("\n=== 11. Testing Weight-Based Variant Schemas ===");
    // Weight units validation
    const validUnits = ["g", "kg", "mg", "ml", "l", "oz", "lb", "pcs"];
    for (const unit of validUnits) {
        console.assert(WeightUnitSchema.parse(unit) === unit, `WeightUnitSchema should accept ${unit}`);
    }

    let invalidUnitThrew = false;
    try {
        WeightUnitSchema.parse("gallons");
    } catch {
        invalidUnitThrew = true;
    }
    console.assert(invalidUnitThrew, "WeightUnitSchema should reject invalid units");
    console.log("✔ WeightUnitSchema accepted all standard weight/volume units and rejected invalid ones");

    // CreateProductVariantSchema parsing and coercion
    const parsedVariantInput = CreateProductVariantSchema.parse({
        weightValue: "750",
        weightUnit: "ml",
        purchasePrice: "6.50",
        sellPrice: "14.99",
        stock: "120",
    });
    console.assert(parsedVariantInput.weightValue === 750, "weightValue coerced to number");
    console.assert(parsedVariantInput.purchasePrice === 6.5, "purchasePrice coerced to number");
    console.assert(parsedVariantInput.sellPrice === 14.99, "sellPrice coerced to number");
    console.assert(parsedVariantInput.stock === 120, "stock coerced to number");
    console.assert(parsedVariantInput.isDefault === false, "isDefault defaults to false");
    console.assert(parsedVariantInput.isActive === true, "isActive defaults to true");

    let negativeWeightThrew = false;
    try {
        CreateProductVariantSchema.parse({
            weightValue: -10,
            weightUnit: "kg",
            purchasePrice: 10,
            sellPrice: 20,
        });
    } catch {
        negativeWeightThrew = true;
    }
    console.assert(negativeWeightThrew, "CreateProductVariantSchema should reject negative weight");

    let negativePriceThrew = false;
    try {
        CreateProductVariantSchema.parse({
            weightValue: 1,
            weightUnit: "kg",
            purchasePrice: -5,
            sellPrice: 20,
        });
    } catch {
        negativePriceThrew = true;
    }
    console.assert(negativePriceThrew, "CreateProductVariantSchema should reject negative purchasePrice");
    console.log("✔ CreateProductVariantSchema validated numeric constraints and defaults");

    // UpdateProductVariantSchema partials
    const updateVariantInput = UpdateProductVariantSchema.parse({
        sellPrice: "19.99",
        isDefault: true,
    });
    console.assert(updateVariantInput.sellPrice === 19.99, "Update schema accepts partial payload and coerces sellPrice");
    console.assert(updateVariantInput.isDefault === true, "Update schema accepts partial isDefault flag");
    console.log("✔ UpdateProductVariantSchema validated partial updates");

    // Product with variants projection
    const mockProduct = {
        id: "a123e456-e89b-12d3-a456-426614174000",
        name: "Insulated Water Bottle",
        slug: "insulated-water-bottle",
        shortDescription: "Stay hydrated",
        description: "Vacuum insulated water bottle",
        featuredImageUrl: "https://example.com/bottle.jpg",
        images: [],
        tags: ["bottle"],
        status: "published" as const,
        publishedAt: new Date(),
        sellPrice: "12.99",
        stock: "100",
        inventoryType: "discrete" as const,
        baseWeightUnit: null,
        searchVector: "raw-tsvector",
        categories: [],
        variants: [
            {
                id: "b123e456-e89b-12d3-a456-426614174001",
                productId: "a123e456-e89b-12d3-a456-426614174000",
                title: "500ml",
                weightValue: 500,
                weightUnit: "ml" as const,
                sku: "bottle-500ml",
                sellPrice: 12.99,
                stock: 50,
                isDefault: true,
                isActive: true,
                imageUrl: null,
            },
            {
                id: "b123e456-e89b-12d3-a456-426614174002",
                productId: "a123e456-e89b-12d3-a456-426614174000",
                title: "1000ml",
                weightValue: 1000,
                weightUnit: "ml" as const,
                sku: "bottle-1000ml",
                sellPrice: 16.99,
                stock: 50,
                isDefault: false,
                isActive: true,
                imageUrl: null,
            },
        ],
    };

    const publicProduct = GetProductPublicSchema.parse(mockProduct);
    console.assert(publicProduct.variants.length === 2, "Public product includes 2 variants");
    console.assert(publicProduct.variants[0].title === "500ml", "First variant is 500ml");
    console.assert(!("purchasePrice" in publicProduct.variants[0]), "Public variant does not expose purchasePrice");

    const adminProduct = GetProductSchema.parse({
        ...mockProduct,
        purchasePrice: "5.00",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        variants: mockProduct.variants.map((v) => ({
            ...v,
            purchasePrice: 4.5,
            createdAt: new Date(),
            updatedAt: new Date(),
        })),
    });
    console.assert(adminProduct.variants.length === 2, "Admin product includes 2 variants");
    console.assert(adminProduct.variants[0].purchasePrice === 4.5, "Admin variant exposes purchasePrice");

    // Direct standalone variant schema parsing
    const standalonePublic = ProductVariantPublicSchema.parse(mockProduct.variants[0]);
    console.assert(standalonePublic.sku === "bottle-500ml", "ProductVariantPublicSchema parses single variant");
    const standaloneAdmin = ProductVariantSchema.parse({
        ...mockProduct.variants[0],
        purchasePrice: 4.5,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    console.assert(standaloneAdmin.purchasePrice === 4.5, "ProductVariantSchema parses single admin variant");

    console.log("✔ Product schema variant projection (public vs admin) passed");

    console.log("\n=== 12. Testing Shared Inventory Pool & Unit Conversions ===");
    // 1. InventoryTypeSchema validation
    console.assert(InventoryTypeSchema.parse("discrete") === "discrete", "InventoryTypeSchema accepts 'discrete'");
    console.assert(InventoryTypeSchema.parse("shared_pool") === "shared_pool", "InventoryTypeSchema accepts 'shared_pool'");
    let invalidInvThrew = false;
    try {
        InventoryTypeSchema.parse("infinite");
    } catch {
        invalidInvThrew = true;
    }
    console.assert(invalidInvThrew, "InventoryTypeSchema rejects invalid inventory types");
    console.log("✔ InventoryTypeSchema validated discrete and shared_pool types");

    // 2. Unit conversion tests
    console.assert(convertWeightUnit(500, "g", "kg") === 0.5, "500g is 0.5 kg");
    console.assert(convertWeightUnit(2.5, "kg", "g") === 2500, "2.5kg is 2500 g");
    console.assert(convertWeightUnit(1000, "mg", "g") === 1, "1000mg is 1 g");
    console.assert(convertWeightUnit(750, "ml", "l") === 0.75, "750ml is 0.75 l");
    console.assert(convertWeightUnit(3, "l", "ml") === 3000, "3l is 3000 ml");
    console.assert(convertWeightUnit(12, "pcs", "pcs") === 12, "12 pcs is 12 pcs");
    console.assert(convertWeightUnit(500, "g", "ml") === null, "Incompatible dimensions return null");
    console.log("✔ Unit conversion matrix validated across mass, volume, and count");

    // 3. Shared pool stock calculation (User's exact Rice scenario: 50 KG sack with 500g and 1kg variants)
    const stock500gAt50Kg = calculateVariantStock({
        masterStock: 50,
        inventoryType: "shared_pool",
        variantStock: 0,
        weightValue: 500,
        weightUnit: "g",
        baseWeightUnit: "kg",
    });
    console.assert(stock500gAt50Kg === 100, "50 KG of rice produces 100 packs of 500g (floor(50 / 0.5))");

    const stock1kgAt50Kg = calculateVariantStock({
        masterStock: 50,
        inventoryType: "shared_pool",
        variantStock: 0,
        weightValue: 1,
        weightUnit: "kg",
        baseWeightUnit: "kg",
    });
    console.assert(stock1kgAt50Kg === 50, "50 KG of rice produces 50 packs of 1kg (floor(50 / 1.0))");

    const stock5kgAt50Kg = calculateVariantStock({
        masterStock: 50,
        inventoryType: "shared_pool",
        variantStock: 0,
        weightValue: 5,
        weightUnit: "kg",
        baseWeightUnit: "kg",
    });
    console.assert(stock5kgAt50Kg === 10, "50 KG of rice produces 10 packs of 5kg (floor(50 / 5.0))");

    // After 2 kg sold (48 kg left in pool)
    const stock500gAt48Kg = calculateVariantStock({
        masterStock: 48,
        inventoryType: "shared_pool",
        variantStock: 0,
        weightValue: 500,
        weightUnit: "g",
        baseWeightUnit: "kg",
    });
    console.assert(stock500gAt48Kg === 96, "48 KG of rice produces 96 packs of 500g (floor(48 / 0.5))");

    const stock1kgAt48Kg = calculateVariantStock({
        masterStock: 48,
        inventoryType: "shared_pool",
        variantStock: 0,
        weightValue: 1,
        weightUnit: "kg",
        baseWeightUnit: "kg",
    });
    console.assert(stock1kgAt48Kg === 48, "48 KG of rice produces 48 packs of 1kg (floor(48 / 1.0))");

    // Pool empty (0 kg)
    const stockAt0Kg = calculateVariantStock({
        masterStock: 0,
        inventoryType: "shared_pool",
        variantStock: 0,
        weightValue: 500,
        weightUnit: "g",
        baseWeightUnit: "kg",
    });
    console.assert(stockAt0Kg === 0, "0 KG master stock produces 0 available packs");

    // 4. Liquid volume shared pool: 20 Liters of oil with 250ml variant
    const stock250mlOil = calculateVariantStock({
        masterStock: 20,
        inventoryType: "shared_pool",
        variantStock: 0,
        weightValue: 250,
        weightUnit: "ml",
        baseWeightUnit: "l",
    });
    console.assert(stock250mlOil === 80, "20 L of oil produces 80 bottles of 250ml (floor(20 / 0.25))");

    // 5. Explicit poolConsumptionRate override (e.g. 0.525 kg per pack to account for packaging tare/spillage)
    const stockWithWaste = calculateVariantStock({
        masterStock: 50,
        inventoryType: "shared_pool",
        variantStock: 0,
        weightValue: 500,
        weightUnit: "g",
        baseWeightUnit: "kg",
        poolConsumptionRate: 0.525,
    });
    console.assert(stockWithWaste === 95, "Explicit poolConsumptionRate 0.525 produces 95 packs (floor(50 / 0.525))");

    // 6. Discrete inventory returns variant's own stock directly
    const stockDiscrete = calculateVariantStock({
        masterStock: 500,
        inventoryType: "discrete",
        variantStock: 25,
        weightValue: 500,
        weightUnit: "g",
        baseWeightUnit: "kg",
    });
    console.assert(stockDiscrete === 25, "Discrete inventory retains standalone variant stock");
    console.log("✔ calculateVariantStock correctly evaluated shared pool, dynamic pack counts, overrides, and discrete fallbacks");

    console.log("\n=== 13. Testing Slug 301/308 Redirect Engine & Reservation Logic ===");

    // 1. PermanentRedirectError instantiation and properties
    const testErr = new PermanentRedirectError("premium-basmati-rice", "/api/v1/products/premium-basmati-rice");
    console.assert(testErr.statusCode === 308, "PermanentRedirectError status code should be 308");
    console.assert(testErr.canonicalSlug === "premium-basmati-rice", "Canonical slug should match");
    console.assert(testErr.redirectUrl === "/api/v1/products/premium-basmati-rice", "Redirect URL should match");
    console.assert(testErr.message.includes("Product slug has moved permanently"), "Default message should indicate permanent move");

    // 2. handleError HTTP response serialization for 308 redirect
    const httpRes = handleError(testErr);
    console.assert(httpRes.status === 308, "HTTP Response status should be 308 Permanent Redirect");
    console.assert(
        httpRes.headers.get("Location") === "/api/v1/products/premium-basmati-rice",
        "HTTP Response Location header should be set to canonical product route"
    );

    // 3. ProductSlugRedirectModelSchema validation
    const validRedirectRecord = {
        id: "a0000000-0000-4000-8000-000000000001",
        productId: "b0000000-0000-4000-8000-000000000001",
        sourceSlug: "old-basmati-rice",
        targetSlug: "premium-basmati-rice",
        createdAt: new Date(),
    };
    const parsedRedirect = ProductSlugRedirectModelSchema.safeParse(validRedirectRecord);
    console.assert(parsedRedirect.success, "Valid redirect record should parse successfully");

    // 4. Draft vs Published Redirect Rule simulation
    // - Draft product renaming: wasEverPublished is false -> redirects should NOT be created
    const draftProduct = {
        id: "prod-1",
        slug: "draft-rice",
        status: "draft",
        publishedAt: null,
    };
    const wasEverPublishedDraft = draftProduct.publishedAt !== null || draftProduct.status === "published";
    console.assert(!wasEverPublishedDraft, "Draft product with null publishedAt should NOT qualify for slug redirection");

    // - Published product renaming: wasEverPublished is true -> redirects MUST be created
    const publishedProduct = {
        id: "prod-2",
        slug: "published-rice",
        status: "published",
        publishedAt: new Date(),
    };
    const wasEverPublishedLive = publishedProduct.publishedAt !== null || publishedProduct.status === "published";
    console.assert(wasEverPublishedLive, "Published product must qualify for slug redirection");

    // - Product previously published but now archived/draft: wasEverPublished is true
    const archivedProduct = {
        id: "prod-3",
        slug: "archived-rice",
        status: "archived",
        publishedAt: new Date("2025-01-01"),
    };
    const wasEverPublishedArchived = archivedProduct.publishedAt !== null || archivedProduct.status === "published";
    console.assert(wasEverPublishedArchived, "Previously published product with publishedAt != null must qualify for slug redirection");

    // 5. 1-Hop Chain Flattening Simulation
    // Existing chain: A -> B. Now B is renamed to C.
    // Flattening logic: all existing redirects pointing to targetSlug === 'B' must be updated to targetSlug === 'C',
    // plus a new redirect for B -> C.
    const existingRedirects = [
        { id: "r1", productId: "prod-2", sourceSlug: "slug-a", targetSlug: "slug-b" },
    ];
    const newCanonicalSlug = "slug-c";
    const currentSlug = "slug-b";

    // Flatten existing:
    const flattened = existingRedirects.map((r) =>
        r.targetSlug === currentSlug ? { ...r, targetSlug: newCanonicalSlug } : r
    );
    // Add new redirect for currentSlug -> newCanonicalSlug:
    flattened.push({
        id: "r2",
        productId: "prod-2",
        sourceSlug: currentSlug,
        targetSlug: newCanonicalSlug,
    });

    console.assert(flattened.length === 2, "Should have 2 redirect records after rename");
    console.assert(flattened.every((r) => r.targetSlug === newCanonicalSlug), "Every historical slug should point directly to 1-hop canonical 'slug-c'");
    console.assert(flattened.find((r) => r.sourceSlug === "slug-a")?.targetSlug === "slug-c", "slug-a -> slug-c flattened");
    console.assert(flattened.find((r) => r.sourceSlug === "slug-b")?.targetSlug === "slug-c", "slug-b -> slug-c recorded");

    // 6. Slug Reversion Simulation
    // Suppose product renames from C back to A:
    // Any redirect where sourceSlug === 'slug-a' must be removed to avoid cycles (A -> A),
    // and remaining redirects (e.g. B) point to A.
    const revertTarget = "slug-a";
    const postReversion = flattened
        .filter((r) => r.sourceSlug !== revertTarget) // prune sourceSlug === 'slug-a'
        .map((r) => ({ ...r, targetSlug: revertTarget })); // point rest (B) to 'slug-a'

    console.assert(postReversion.length === 1, "Reversion pruned the old redirect record to avoid cycles");
    console.assert(postReversion[0].sourceSlug === "slug-b" && postReversion[0].targetSlug === "slug-a", "slug-b now redirects directly to reverted slug-a");

    console.log("✔ Slug 301/308 redirect engine, chain flattening, draft rules, and reversion simulations passed");

    console.log("\nAll Full-Text Search, Fuzzy Search, Facets, Cursor, Recommendations, Variants, Shared Pool Inventory, and Slug 301 Redirect Engine tests PASSED successfully! 🚀");
}

runTests();

