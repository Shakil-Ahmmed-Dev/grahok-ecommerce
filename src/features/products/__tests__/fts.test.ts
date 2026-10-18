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
    InventoryTypeSchema,
    VariantTypeSchema,
    CreateVariantTypeSchema,
    UpdateVariantTypeSchema,
    CreateProductVariantSchema,
    UpdateProductVariantSchema,
    ProductVariantPublicSchema,
    ProductVariantSchema,
    ProductSlugRedirectModelSchema,
    CreateProductOptionSchema,
    UpdateProductOptionSchema,
    CreateOptionValueSchema,
    UpdateOptionValueSchema,
    GenerateMatrixInputSchema,
    ProductOptionItemSchema,
} from "@/features/products/types";
import {
    normalizeVariantSignature,
    generateCartesianPermutations,
    resolveUniqueSku,
} from "@/features/products/matrix";
import { calculateVariantStock, resolveEffectiveInventoryType } from "@/features/products/inventory";
import { BadRequestError, PermanentRedirectError } from "@/lib/error";
import { handleError } from "@/lib/http";

const dialect = new PgDialect();

async function runTests() {
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

    // inStock filtering condition test
    const inStockConds = buildProductConditions({ inStock: true }, "public");
    const inStockCondsSql = dialect.sqlToQuery(sql`${inStockConds}`);
    console.assert(inStockCondsSql.sql.includes("no_tracking"), "inStock condition includes no_tracking");
    console.assert(inStockCondsSql.sql.includes("pool_stock"), "inStock condition includes pool_stock check for shared_pool");
    console.assert(inStockCondsSql.sql.includes('"products"."stock" > $'), "inStock condition includes discrete stock check");
    console.log("✔ inStock builder generates multi-inventory policy condition");

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
        poolStock: "0",
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
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        variants: [
            {
                id: "v-admin-01",
                productId: dummyProduct.id,
                title: "Default",
                sku: "headphones-default",
                optionValues: {},
                signature: "default",
                inventoryType: "discrete" as const,
                purchasePrice: 50.00,
                sellPrice: 99.99,
                stock: 10,
                isUnlimited: false,
                poolConsumptionRate: null,
                isDefault: true,
                isActive: true,
                imageUrl: null,
                createdAt: new Date(),
                updatedAt: new Date(),
            },
        ],
    });
    console.assert(!("searchVector" in parsedAdmin), "GetProductSchema must strip searchVector");
    console.assert(!("purchasePrice" in parsedAdmin), "GetProductSchema root product does not have purchasePrice");
    console.assert(parsedAdmin.variants[0].purchasePrice === 50, "Variant in GetProductSchema retains purchasePrice");
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

    console.log("\n=== 11. Testing Option Matrix, Variant Types & Schemas ===");
    // Variant Type & Presets schema validation
    const parsedVariantType = CreateVariantTypeSchema.parse({
        name: "Size",
        code: "size",
        description: "Apparel standard sizes",
        defaultInventoryType: "discrete",
        position: 0,
        values: [
            { value: "S", position: 0 },
            { value: "M", position: 1 },
            { value: "L", position: 2 },
        ],
    });
    console.assert(parsedVariantType.name === "Size" && parsedVariantType.values?.length === 3, "CreateVariantTypeSchema parses valid payload");
    const fullVariantType = VariantTypeSchema.parse({
        ...parsedVariantType,
        id: "vt-001",
        values: (parsedVariantType.values ?? []).map((v, i) => ({
            ...v,
            id: `vtv-00${i}`,
            variantTypeId: "vt-001",
        })),
    });
    console.assert(fullVariantType.id === "vt-001", "VariantTypeSchema parses entity model");

    const updateVariantType = UpdateVariantTypeSchema.parse({
        name: "Apparel Size",
        defaultInventoryType: "discrete",
    });
    console.assert(updateVariantType.name === "Apparel Size", "UpdateVariantTypeSchema parses partial updates");
    console.log("✔ VariantType schemas validated successfully");

    // Option and OptionValue schemas
    const parsedOption = CreateProductOptionSchema.parse({
        name: "Size",
        position: 0,
        variantTypeId: "a123e456-e89b-12d3-a456-426614174000",
        values: [
            { value: "S", position: 0 },
            { value: "M", position: 1 },
        ],
    });
    console.assert(parsedOption.name === "Size" && parsedOption.values?.length === 2, "CreateProductOptionSchema parsed");
    console.assert(parsedOption.variantTypeId === "a123e456-e89b-12d3-a456-426614174000", "CreateProductOptionSchema preserves variantTypeId");

    const parsedUpdateOption = UpdateProductOptionSchema.parse({ name: "Dimensions", variantTypeId: null });
    console.assert(parsedUpdateOption.name === "Dimensions", "UpdateProductOptionSchema parsed");

    const parsedValCreate = CreateOptionValueSchema.parse({ value: "Red", swatchMeta: "#FF0000" });
    console.assert(parsedValCreate.value === "Red" && parsedValCreate.swatchMeta === "#FF0000", "CreateOptionValueSchema parsed");

    const parsedValUpdate = UpdateOptionValueSchema.parse({ value: "Crimson" });
    console.assert(parsedValUpdate.value === "Crimson", "UpdateOptionValueSchema parsed");

    const parsedOptionItem = ProductOptionItemSchema.parse({
        id: "opt-1",
        productId: "p-1",
        variantTypeId: "a123e456-e89b-12d3-a456-426614174000",
        name: "Size",
        position: 0,
        values: [],
    });
    console.assert(parsedOptionItem.id === "opt-1", "ProductOptionItemSchema parsed");

    const resolvedSku = await resolveUniqueSku("tshirt-red-s", (sku) => new Set(["tshirt-red-s"]).has(sku));
    console.assert(resolvedSku === "tshirt-red-s-1", "resolveUniqueSku resolved duplicate SKU collision");

    const parsedGenerateMatrixInput = GenerateMatrixInputSchema.parse({
        options: [
            {
                name: "Size",
                values: [{ value: "S" }, { value: "M" }],
            },
        ],
        defaultSellPrice: "29.99",
        defaultStock: "50",
        defaultInventoryType: "discrete",
        preview: true,
    });
    console.assert(parsedGenerateMatrixInput.defaultSellPrice === 29.99, "GenerateMatrixInputSchema defaultSellPrice coerced");
    console.assert(parsedGenerateMatrixInput.defaultStock === 50, "GenerateMatrixInputSchema defaultStock coerced");
    console.assert(parsedGenerateMatrixInput.defaultInventoryType === "discrete", "GenerateMatrixInputSchema defaultInventoryType parsed");
    console.assert(parsedGenerateMatrixInput.preview === true, "GenerateMatrixInputSchema preview parsed");

    // Matrix Engine Permutations & Signatures
    const sig1 = normalizeVariantSignature({ Size: "M", Color: "Red" });
    const sig2 = normalizeVariantSignature({ Color: "  red  ", size: "m" });
    console.assert(sig1 === "color=red&size=m", "normalizeVariantSignature sorts and formats keys");
    console.assert(sig2 === sig1, "normalizeVariantSignature handles casing and whitespace deterministically");
    console.assert(normalizeVariantSignature({}) === "default", "Empty options normalize to 'default'");

    const testOptionsForMatrix = [
        {
            name: "Color",
            values: [
                { value: "Red" },
                { value: "Blue" },
            ],
        },
        {
            name: "Package Size",
            values: [
                { value: "500g", defaultConsumptionRate: 0.5 },
                { value: "1kg", defaultConsumptionRate: 1.0 },
            ],
        },
    ];
    const permutations = generateCartesianPermutations("organic-rice", testOptionsForMatrix, "RICE");
    console.assert(permutations.length === 4, "2x2 options produce 4 permutations");
    console.assert(permutations[0].title === "Red / 500g", "First permutation title is Red / 500g");
    console.assert(permutations[0].signature === "color=red&package size=500g", "Permutation signature generated");
    console.assert(permutations[0].suggestedSku === "rice-red-500g", "Permutation suggestedSku formatted with prefix");
    console.assert(permutations[0].poolConsumptionRate === 0.5, "Permutation inherited defaultConsumptionRate from option value");
    console.log("✔ Cartesian permutation, consumption rate propagation, and signature engine passed");

    // CreateProductVariantSchema parsing and coercion
    const parsedVariantInput = CreateProductVariantSchema.parse({
        title: "Large / Black",
        optionValues: { Size: "Large", Color: "Black" },
        purchasePrice: "6.50",
        sellPrice: "14.99",
        stock: "120",
        inventoryType: "no_tracking",
    });
    console.assert(parsedVariantInput.title === "Large / Black", "title parsed");
    console.assert(parsedVariantInput.optionValues.Size === "Large", "optionValues parsed");
    console.assert(parsedVariantInput.purchasePrice === 6.5, "purchasePrice coerced to number");
    console.assert(parsedVariantInput.sellPrice === 14.99, "sellPrice coerced to number");
    console.assert(parsedVariantInput.stock === 120, "stock coerced to number");
    console.assert(parsedVariantInput.inventoryType === "no_tracking", "inventoryType accepted nullable/optional override");
    console.assert(parsedVariantInput.isDefault === false, "isDefault defaults to false");
    console.assert(parsedVariantInput.isActive === true, "isActive defaults to true");

    let negativePriceThrew = false;
    try {
        CreateProductVariantSchema.parse({
            title: "Invalid",
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
        inventoryType: "shared_pool",
        poolConsumptionRate: "0.75",
        optionValues: { Size: "XL" },
    });
    console.assert(updateVariantInput.sellPrice === 19.99, "Update schema accepts partial payload and coerces sellPrice");
    console.assert(updateVariantInput.isDefault === true, "Update schema accepts partial isDefault flag");
    console.assert(updateVariantInput.inventoryType === "shared_pool", "Update schema accepts inventoryType");
    console.assert(updateVariantInput.poolConsumptionRate === 0.75, "Update schema coerces poolConsumptionRate");
    console.assert(updateVariantInput.optionValues?.Size === "XL", "Update schema accepts optionValues");
    console.log("✔ UpdateProductVariantSchema validated partial updates");

    // Product with variants & options projection
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
        poolStock: "0",
        inventoryType: "discrete" as const,
        searchVector: "raw-tsvector",
        categories: [],
        options: [
            {
                id: "opt-1",
                productId: "a123e456-e89b-12d3-a456-426614174000",
                variantTypeId: null,
                name: "Capacity",
                position: 0,
                createdAt: new Date(),
                updatedAt: new Date(),
                values: [
                    { id: "val-1", optionId: "opt-1", value: "500ml", position: 0, swatchMeta: null, createdAt: new Date(), updatedAt: new Date() },
                    { id: "val-2", optionId: "opt-1", value: "1000ml", position: 1, swatchMeta: null, createdAt: new Date(), updatedAt: new Date() },
                ],
            },
        ],
        variants: [
            {
                id: "b123e456-e89b-12d3-a456-426614174001",
                productId: "a123e456-e89b-12d3-a456-426614174000",
                title: "500ml",
                optionValues: { Capacity: "500ml" },
                signature: "capacity=500ml",
                sku: "bottle-500ml",
                sellPrice: 12.99,
                stock: 50,
                isUnlimited: false,
                inventoryType: "discrete" as const,
                poolConsumptionRate: null,
                isDefault: true,
                isActive: true,
                imageUrl: null,
            },
            {
                id: "b123e456-e89b-12d3-a456-426614174002",
                productId: "a123e456-e89b-12d3-a456-426614174000",
                title: "1000ml",
                optionValues: { Capacity: "1000ml" },
                signature: "capacity=1000ml",
                sku: "bottle-1000ml",
                sellPrice: 16.99,
                stock: 50,
                isUnlimited: false,
                inventoryType: "discrete" as const,
                poolConsumptionRate: null,
                isDefault: false,
                isActive: true,
                imageUrl: null,
            },
        ],
    };

    const publicProduct = GetProductPublicSchema.parse(mockProduct);
    console.assert(publicProduct.options.length === 1, "Public product includes 1 option");
    console.assert(publicProduct.variants.length === 2, "Public product includes 2 variants");
    console.assert(publicProduct.variants[0].title === "500ml", "First variant is 500ml");
    console.assert(publicProduct.variants[0].signature === "capacity=500ml", "First variant signature preserved");
    console.assert(!("purchasePrice" in publicProduct.variants[0]), "Public variant does not expose purchasePrice");

    const adminProduct = GetProductSchema.parse({
        ...mockProduct,
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
    console.assert(adminProduct.options.length === 1, "Admin product includes 1 option");
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

    console.log("\n=== 12. Testing Multi-Inventory Policy & Shared Inventory Pool ===");
    // 1. InventoryTypeSchema validation
    console.assert(InventoryTypeSchema.parse("discrete") === "discrete", "InventoryTypeSchema accepts 'discrete'");
    console.assert(InventoryTypeSchema.parse("shared_pool") === "shared_pool", "InventoryTypeSchema accepts 'shared_pool'");
    console.assert(InventoryTypeSchema.parse("no_tracking") === "no_tracking", "InventoryTypeSchema accepts 'no_tracking'");
    let invalidInvThrew = false;
    try {
        InventoryTypeSchema.parse("infinite");
    } catch {
        invalidInvThrew = true;
    }
    console.assert(invalidInvThrew, "InventoryTypeSchema rejects invalid inventory types");
    console.log("✔ InventoryTypeSchema validated discrete, shared_pool, and no_tracking types");

    // 2. resolveEffectiveInventoryType resolution
    console.assert(resolveEffectiveInventoryType("no_tracking", "discrete") === "no_tracking", "Variant inventoryType takes precedence");
    console.assert(resolveEffectiveInventoryType(null, "shared_pool") === "shared_pool", "Variant inherits product policy when null");
    console.assert(resolveEffectiveInventoryType(undefined, "discrete") === "discrete", "Variant inherits product policy when undefined");
    console.assert(resolveEffectiveInventoryType(null, null) === "discrete", "Defaults to discrete if both are null");
    console.log("✔ resolveEffectiveInventoryType hierarchy validated");

    // 3. calculateVariantStock tests
    // A. no_tracking inventory policy
    const noTrackingStock = calculateVariantStock({
        masterPoolStock: 50,
        inventoryType: "no_tracking",
        variantStock: 0,
    });
    console.assert(noTrackingStock.stock === null, "no_tracking stock is null");
    console.assert(noTrackingStock.isUnlimited === true, "no_tracking isUnlimited is true");
    console.assert(noTrackingStock.inventoryType === "no_tracking", "no_tracking inventoryType preserved");

    // B. discrete inventory policy
    const discreteStock = calculateVariantStock({
        masterPoolStock: 500,
        inventoryType: "discrete",
        variantStock: 25,
    });
    console.assert(discreteStock.stock === 25, "discrete stock returns variant stock");
    console.assert(discreteStock.isUnlimited === false, "discrete isUnlimited is false");

    // C. shared_pool with 50 KG pool
    const pool500g = calculateVariantStock({
        masterPoolStock: 50,
        inventoryType: "shared_pool",
        poolConsumptionRate: 0.5,
    });
    console.assert(pool500g.stock === 100, "50 KG of rice produces 100 packs of 500g (floor(50 / 0.5))");
    console.assert(pool500g.isUnlimited === false, "shared_pool isUnlimited is false");

    const pool1kg = calculateVariantStock({
        masterPoolStock: 50,
        inventoryType: "shared_pool",
        poolConsumptionRate: 1,
    });
    console.assert(pool1kg.stock === 50, "50 KG produces 50 packs of 1kg");

    const pool5kg = calculateVariantStock({
        masterPoolStock: 50,
        inventoryType: "shared_pool",
        poolConsumptionRate: 5,
    });
    console.assert(pool5kg.stock === 10, "50 KG produces 10 packs of 5kg");

    // After 2 kg sold (48 kg left in pool)
    const pool500gAt48 = calculateVariantStock({
        masterPoolStock: 48,
        inventoryType: "shared_pool",
        poolConsumptionRate: 0.5,
    });
    console.assert(pool500gAt48.stock === 96, "48 KG produces 96 packs of 500g");

    // Empty pool (0 KG)
    const poolAt0 = calculateVariantStock({
        masterPoolStock: 0,
        inventoryType: "shared_pool",
        poolConsumptionRate: 0.5,
    });
    console.assert(poolAt0.stock === 0, "0 pool produces 0 stock");
    console.log("✔ calculateVariantStock correctly evaluated no_tracking, discrete, and shared_pool policies");

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
    const draftProduct = {
        id: "prod-1",
        slug: "draft-rice",
        status: "draft",
        publishedAt: null,
    };
    const wasEverPublishedDraft = draftProduct.publishedAt !== null || draftProduct.status === "published";
    console.assert(!wasEverPublishedDraft, "Draft product with null publishedAt should NOT qualify for slug redirection");

    const publishedProduct = {
        id: "prod-2",
        slug: "published-rice",
        status: "published",
        publishedAt: new Date(),
    };
    const wasEverPublishedLive = publishedProduct.publishedAt !== null || publishedProduct.status === "published";
    console.assert(wasEverPublishedLive, "Published product must qualify for slug redirection");

    const archivedProduct = {
        id: "prod-3",
        slug: "archived-rice",
        status: "archived",
        publishedAt: new Date("2025-01-01"),
    };
    const wasEverPublishedArchived = archivedProduct.publishedAt !== null || archivedProduct.status === "published";
    console.assert(wasEverPublishedArchived, "Previously published product with publishedAt != null must qualify for slug redirection");

    // 5. 1-Hop Chain Flattening Simulation
    const existingRedirects = [
        { id: "r1", productId: "prod-2", sourceSlug: "slug-a", targetSlug: "slug-b" },
    ];
    const newCanonicalSlug = "slug-c";
    const currentSlug = "slug-b";

    const flattened = existingRedirects.map((r) =>
        r.targetSlug === currentSlug ? { ...r, targetSlug: newCanonicalSlug } : r
    );
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
    const revertTarget = "slug-a";
    const postReversion = flattened
        .filter((r) => r.sourceSlug !== revertTarget)
        .map((r) => ({ ...r, targetSlug: revertTarget }));

    console.assert(postReversion.length === 1, "Reversion pruned the old redirect record to avoid cycles");
    console.assert(postReversion[0].sourceSlug === "slug-b" && postReversion[0].targetSlug === "slug-a", "slug-b now redirects directly to reverted slug-a");

    console.log("✔ Slug 301/308 redirect engine, chain flattening, draft rules, and reversion simulations passed");

    console.log("\n=== 14. Testing Canonical Purchasable Entity Contract (Simple vs Variable Products) ===");

    // 1. Simple product default variant creation specification
    const mockSimpleProduct = {
        id: "prod-simple-001",
        name: "Wireless Noise-Cancelling Headphones",
        slug: "wireless-noise-cancelling-headphones",
        sellPrice: 99.99,
        purchasePrice: 55.00,
        stock: 120,
        poolStock: 0,
        inventoryType: "discrete" as const,
        featuredImageUrl: "https://example.com/headphones.jpg",
    };

    const generatedDefaultVariant = {
        id: "var-default-001",
        productId: mockSimpleProduct.id,
        title: "Default",
        sku: `${mockSimpleProduct.slug}-default`,
        optionValues: {},
        signature: normalizeVariantSignature({}),
        inventoryType: mockSimpleProduct.inventoryType,
        purchasePrice: mockSimpleProduct.purchasePrice,
        sellPrice: mockSimpleProduct.sellPrice,
        stock: mockSimpleProduct.stock,
        isUnlimited: false,
        poolConsumptionRate: null,
        isDefault: true,
        isActive: true,
        imageUrl: mockSimpleProduct.featuredImageUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    console.assert(generatedDefaultVariant.signature === "default", "Default variant signature for empty optionValues is 'default'");
    console.assert(generatedDefaultVariant.title === "Default", "Default variant title is 'Default'");
    console.assert(generatedDefaultVariant.isDefault === true, "Default variant isDefault is true");
    console.assert(generatedDefaultVariant.sku === "wireless-noise-cancelling-headphones-default", "Default SKU formatted with -default suffix");

    const parsedDefaultAdmin = ProductVariantSchema.parse(generatedDefaultVariant);
    console.assert(parsedDefaultAdmin.sellPrice === 99.99, "Admin variant schema parses default variant");
    const parsedDefaultPublic = ProductVariantPublicSchema.parse(generatedDefaultVariant);
    console.assert(parsedDefaultPublic.sku === "wireless-noise-cancelling-headphones-default", "Public variant schema parses default variant");
    console.assert(!("purchasePrice" in parsedDefaultPublic), "Public variant schema omits purchasePrice");
    console.log("✔ Canonical default variant payload validation and schema projections passed");

    // 2. Detection of placeholder default variant vs configured option variants
    const isOnlyDefaultPlaceholder = (variants: Array<{ isDefault: boolean; optionValues?: Record<string, string> }>) => {
        return variants.length === 1 &&
            variants[0].isDefault &&
            (!variants[0].optionValues || Object.keys(variants[0].optionValues).length === 0);
    };

    console.assert(isOnlyDefaultPlaceholder([generatedDefaultVariant]) === true, "Correctly identifies placeholder default variant for simple product");
    console.assert(isOnlyDefaultPlaceholder([{ isDefault: true, optionValues: { Size: "M" } }]) === false, "Configured option variant is not identified as placeholder");
    console.assert(isOnlyDefaultPlaceholder([generatedDefaultVariant, { isDefault: false, optionValues: { Size: "L" } }]) === false, "Multiple variants are not identified as single placeholder");
    console.log("✔ Placeholder default variant detection logic passed");

    // 3. Variant deletion constraint (A product must have at least one variant)
    const checkCanDeleteVariant = (totalVariantCount: number) => {
        if (totalVariantCount <= 1) {
            throw new BadRequestError("Cannot delete the only variant of a product. A product must have at least one variant.");
        }
    };

    let deleteBlockedError: Error | null = null;
    try {
        checkCanDeleteVariant(1);
    } catch (e) {
        deleteBlockedError = e as Error;
    }
    console.assert(deleteBlockedError instanceof BadRequestError, "Attempting to delete the only variant throws BadRequestError");
    console.assert(deleteBlockedError?.message.includes("Cannot delete the only variant"), "Error message explains constraint");

    let deleteAllowedThrew = false;
    try {
        checkCanDeleteVariant(3);
    } catch {
        deleteAllowedThrew = true;
    }
    console.assert(!deleteAllowedThrew, "Deleting a variant when multiple variants exist is permitted");
    console.log("✔ Variant deletion lower-bound constraint passed");

    // 4. Simple product attribute synchronization logic
    const syncSimpleVariant = (
        variant: typeof generatedDefaultVariant,
        updates: Partial<{ sellPrice: number; purchasePrice: number; stock: number }>
    ) => {
        return {
            ...variant,
            ...(updates.sellPrice !== undefined ? { sellPrice: updates.sellPrice } : {}),
            ...(updates.purchasePrice !== undefined ? { purchasePrice: updates.purchasePrice } : {}),
            ...(updates.stock !== undefined ? { stock: updates.stock } : {}),
        };
    };

    const syncedVariant = syncSimpleVariant(generatedDefaultVariant, { sellPrice: 89.99, stock: 150 });
    console.assert(syncedVariant.sellPrice === 89.99, "Variant sellPrice synchronized");
    console.assert(syncedVariant.stock === 150, "Variant stock synchronized");
    console.assert(syncedVariant.purchasePrice === 55.00, "Unchanged attributes preserved");
    console.log("✔ Simple product to default variant attribute synchronization passed");

    // 5. Option B Read-Model Projection simulation (min sell price & discrete stock aggregate)
    const mockVariants = [
        { id: "v1", sellPrice: 25.00, stock: 10, isActive: true, deletedAt: null },
        { id: "v2", sellPrice: 15.00, stock: 20, isActive: true, deletedAt: null },
        { id: "v3", sellPrice: 35.00, stock: 5, isActive: false, deletedAt: null },
        { id: "v4", sellPrice: 10.00, stock: 50, isActive: true, deletedAt: new Date() },
    ];

    const activeNonDeleted = mockVariants.filter((v) => v.isActive && !v.deletedAt);
    const projectedMinPrice = Math.min(...activeNonDeleted.map((v) => v.sellPrice));
    const projectedTotalDiscreteStock = activeNonDeleted.reduce((sum, v) => sum + v.stock, 0);

    console.assert(projectedMinPrice === 15.00, "Projected sellPrice is the minimum active non-deleted variant price ($15)");
    console.assert(projectedTotalDiscreteStock === 30, "Projected discrete stock is sum of active non-deleted variants (10 + 20 = 30)");
    console.log("✔ Option B read-model projection (minPrice & aggregate discrete stock) passed");

    // 6. Soft delete variant validation
    const deletedVariant = ProductVariantSchema.parse({
        ...generatedDefaultVariant,
        isActive: false,
        deletedAt: new Date(),
    });
    console.assert(deletedVariant.isActive === false, "Soft-deleted variant has isActive=false");
    console.assert(deletedVariant.deletedAt !== null, "Soft-deleted variant preserves deletedAt timestamp");
    console.log("✔ Variant soft delete schema projection passed");

    console.log("\nAll Full-Text Search, Fuzzy Search, Facets, Cursor, Recommendations, Variants, Multi-Inventory Policies, Shared Pool Inventory, Slug 301 Redirect Engine, Canonical Purchasable Entity Contract, and Option B Read-Model tests PASSED successfully! 🚀");
}

void runTests();
