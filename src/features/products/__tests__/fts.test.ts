import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import {
    buildProductSearchQuery,
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
    ProductQuerySchema,
    ProductsListSchema,
} from "@/features/products/types";

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
    // Table of behavior:
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
    const conds = buildProductConditions({ search: "headphones" }, "public", searchQ);
    const condSql = dialect.sqlToQuery(sql`${conds}`);
    console.assert(condSql.sql.includes('"search_vector" @@'), "Conditions must include search_vector @@ query");
    console.log("✔ Condition builder generates FTS @@ predicate:", condSql.sql);

    const orderRelevance = buildProductOrderBy("relevance", "desc", searchQ);
    const orderSql = dialect.sqlToQuery(sql`${orderRelevance[0]}`);
    console.assert(orderSql.sql.includes('ts_rank("products"."search_vector"'), "Order by relevance must use ts_rank");
    console.log("✔ Order builder generates ts_rank relevance ranking:", orderSql.sql);

    console.log("\n=== 4. Testing Schema Projection Safety ===");
    // Ensure searchVector cannot be parsed or present in output
    const dummyProduct = {
        id: "123e4567-e89b-12d3-a456-426614174000",
        name: "Wireless Headphones",
        slug: "wireless-headphones",
        category: "Electronics",
        subcategory: "Audio",
        tags: ["audio"],
        featuredImageUrl: "https://example.com/img.jpg",
        images: [],
        sellPrice: "99.99",
        stock: "10",
        searchVector: "some-raw-tsvector-data",
    };

    const parsedPublic = GetProductPublicSchema.parse(dummyProduct);
    console.assert(!("searchVector" in parsedPublic), "GetProductPublicSchema must strip searchVector");

    const parsedAdmin = GetProductSchema.parse({
        ...dummyProduct,
        purchasePrice: "50.00",
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
    });
    console.assert(!("searchVector" in parsedAdmin), "GetProductSchema must strip searchVector");
    console.log("✔ searchVector successfully stripped from all external schema projections");

    // Test ProductSortSchema parsing
    const parsedDefault = ProductSortSchema.parse({});
    console.assert(parsedDefault.sortBy === undefined, "ProductSortSchema must leave sortBy optional when omitted");
    const parsedExplicit = ProductSortSchema.parse({ sortBy: "relevance" });
    console.assert(parsedExplicit.sortBy === "relevance", "ProductSortSchema accepts relevance");

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

    // Invalid cursors
    console.assert(decodeCursor("invalid-base64!!!") === null, "Malformed base64 should return null");
    console.assert(decodeCursor(Buffer.from(JSON.stringify({ notCreatedAt: "x" })).toString("base64url")) === null, "Invalid cursor payload should return null");
    console.assert(decodeCursor(Buffer.from(JSON.stringify({ createdAt: "not-a-date", id: "123" })).toString("base64url")) === null, "Invalid date string should return null");
    console.log("✔ Malformed cursor error handling passed");

    // Cursor SQL condition
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
        categories: [{ name: "Electronics", count: 42 }],
        subcategories: [{ name: "Audio", count: 18 }],
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
            category: "Electronics",
            sellPrice: 99.99,
            featuredImageUrl: "https://example.com/img.jpg",
        }],
        categories: ["Electronics", "Audio"],
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

    console.log("\nAll Full-Text Search, Facets, and Cursor tests PASSED successfully! 🚀");
}

runTests();
