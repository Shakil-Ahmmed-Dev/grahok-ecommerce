import { and, asc, desc, eq, gt, gte, isNull, lte, or, sql, type SQL } from "drizzle-orm";
import z from "zod";
import { categoriesTable, productCategoriesTable, productsTable, productVariantsTable } from "@/lib/drizzle/schemas/public";
import { db } from "@/lib/drizzle";
import { ProductFacetsSchema, type TProductFacets, type TProductSort, type TProductStatus } from "./types";

export interface TCursorPayload {
    createdAt: string;
    id: string;
}

export const encodeCursor = (createdAt: Date, id: string): string => {
    const payload: TCursorPayload = {
        createdAt: createdAt.toISOString(),
        id,
    };
    return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
};

export const decodeCursor = (cursor: string): { createdAt: Date; id: string } | null => {
    try {
        const decoded = Buffer.from(cursor, "base64url").toString("utf8");
        const parsed = JSON.parse(decoded) as TCursorPayload;
        if (!parsed || typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
            return null;
        }
        const createdAt = new Date(parsed.createdAt);
        if (isNaN(createdAt.getTime()) || !parsed.id.trim()) {
            return null;
        }
        return { createdAt, id: parsed.id.trim() };
    } catch {
        return null;
    }
};

export const buildCursorCondition = (
    cursor: { createdAt: Date; id: string },
    sortOrder: "asc" | "desc" = "desc"
): SQL => {
    if (sortOrder === "asc") {
        return sql`(${productsTable.createdAt} > ${cursor.createdAt} OR (${productsTable.createdAt} = ${cursor.createdAt} AND ${productsTable.id} > ${cursor.id}))`;
    }
    return sql`(${productsTable.createdAt} < ${cursor.createdAt} OR (${productsTable.createdAt} = ${cursor.createdAt} AND ${productsTable.id} < ${cursor.id}))`;
};

export interface TProductFilterFields {
    search?: string;
    category?: string;
    tags?: string[];
    options?: Record<string, string>;
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    status?: TProductStatus;
    includeDeleted?: boolean;
    cursor?: string;
    includeFacets?: boolean;
}

export const buildProductSearchQuery = (search: string | undefined): SQL | null => {
    if (!search) {
        return null;
    }
    const trimmed = search.trim();
    if (!trimmed) {
        return null;
    }

    const hasAdvancedSyntax = /["|-]|\bOR\b/.test(trimmed);
    const words = trimmed.split(/\s+/).filter(Boolean);
    const isPlainWords = !hasAdvancedSyntax && words.length > 0 && words.every((w) => /^[a-zA-Z0-9]+$/.test(w));

    if (isPlainWords) {
        const prefixTerms = words.map((w) => `${w}:*`).join(" & ");
        return sql`(websearch_to_tsquery('english', ${trimmed}) || to_tsquery('english', ${prefixTerms}))`;
    }

    return sql`websearch_to_tsquery('english', ${trimmed})`;
};

export const buildFuzzySearchCondition = (search: string | undefined): SQL | null => {
    if (!search) {
        return null;
    }
    const trimmed = search.trim();
    if (!trimmed) {
        return null;
    }
    return sql`(${productsTable.name} % ${trimmed} OR word_similarity(${trimmed}, ${productsTable.name}) > 0.25)`;
};

export const buildFuzzyOrderBy = (
    search: string,
    sortOrder: TProductSort["sortOrder"] = "desc"
): SQL[] => {
    const trimmed = search.trim();
    const rankSql = sql`greatest(similarity(${productsTable.name}, ${trimmed}), word_similarity(${trimmed}, ${productsTable.name}))`;
    const direction = sortOrder === "asc" ? asc : desc;
    return [
        direction(rankSql),
        desc(productsTable.createdAt),
    ];
};

export const resolveProductSort = (query: {
    search?: string;
    sortBy?: TProductSort["sortBy"];
}): NonNullable<TProductSort["sortBy"]> => {
    return query.sortBy ?? (query.search?.trim() ? "relevance" : "createdAt");
};

export const buildProductConditions = (
    query: TProductFilterFields,
    mode: "public" | "admin",
    searchQuery?: SQL | null,
    cursorCondition?: SQL | null,
    fuzzyCondition?: SQL | null,
): SQL | undefined => {
    const conditions: SQL[] = [];

    if (mode === "public") {
        conditions.push(isNull(productsTable.deletedAt));
        conditions.push(
            or(
                eq(productsTable.status, "published"),
                and(
                    eq(productsTable.status, "scheduled"),
                    lte(productsTable.publishedAt, sql`NOW()`)
                )
            )!
        );
    } else {
        if (query.status) {
            conditions.push(eq(productsTable.status, query.status));
        }
        if (!query.includeDeleted) {
            conditions.push(isNull(productsTable.deletedAt));
        }
    }

    if (searchQuery) {
        conditions.push(sql`${productsTable.searchVector} @@ ${searchQuery}`);
    } else if (fuzzyCondition) {
        conditions.push(fuzzyCondition);
    }

    if (cursorCondition) {
        conditions.push(cursorCondition);
    }

    if (query.category) {
        conditions.push(sql`EXISTS (
            WITH RECURSIVE cat_tree AS (
                SELECT id FROM ${categoriesTable} WHERE ${categoriesTable.slug} = ${query.category} OR ${categoriesTable.id}::text = ${query.category}
                UNION ALL
                SELECT c.id FROM ${categoriesTable} c JOIN cat_tree ct ON c.parent_id = ct.id
            )
            SELECT 1 FROM ${productCategoriesTable} pc
            WHERE pc.product_id = ${productsTable.id}
              AND pc.category_id IN (SELECT id FROM cat_tree)
        )`);
    }

    if (query.tags && query.tags.length > 0) {
        conditions.push(sql`${productsTable.tags} ?| ${sql.param(query.tags)}`);
    }

    if (query.options && Object.keys(query.options).length > 0) {
        const jsonFilter = JSON.stringify(query.options);
        conditions.push(sql`EXISTS (
            SELECT 1 FROM ${productVariantsTable} pv
            WHERE pv.product_id = ${productsTable.id}
              AND pv.is_active = true
              AND pv.option_values @> ${jsonFilter}::jsonb
        )`);
    }

    if (query.minPrice !== undefined) {
        conditions.push(gte(productsTable.sellPrice, query.minPrice));
    }

    if (query.maxPrice !== undefined) {
        conditions.push(lte(productsTable.sellPrice, query.maxPrice));
    }

    if (query.inStock === true) {
        conditions.push(gt(productsTable.stock, 0));
    }

    return and(...conditions);
};

export const getProductFacets = async (
    conditions: SQL | undefined,
    dbInstance = db
): Promise<TProductFacets> => {
    const whereClause = conditions ? sql`WHERE ${conditions}` : sql``;

    const facetSql = sql`
        WITH matched AS (
            SELECT 
                ${productsTable.id} AS id,
                ${productsTable.tags} AS tags,
                ${productsTable.sellPrice} AS sell_price
            FROM ${productsTable}
            ${whereClause}
        ),
        cat_counts AS (
            SELECT json_agg(json_build_object('id', c.id, 'name', c.name, 'slug', c.slug, 'count', s.c)) AS categories
            FROM (
                SELECT pc.category_id as cat_id, count(DISTINCT m.id)::int AS c
                FROM matched m
                JOIN ${productCategoriesTable} pc ON pc.product_id = m.id
                GROUP BY pc.category_id
                ORDER BY c DESC
                LIMIT 20
            ) s
            JOIN ${categoriesTable} c ON c.id = s.cat_id
        ),
        tag_counts AS (
            SELECT json_agg(json_build_object('name', tag, 'count', c)) AS tags
            FROM (
                SELECT tag, count(*)::int AS c
                FROM matched, jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) AS tag
                GROUP BY tag
                ORDER BY c DESC
                LIMIT 30
            ) s
        ),
        option_facets AS (
            SELECT COALESCE(json_agg(json_build_object('name', opt_name, 'values', opt_vals)), '[]'::json) AS options
            FROM (
                SELECT 
                    opt_name,
                    json_agg(json_build_object('value', opt_val, 'count', cnt) ORDER BY cnt DESC) AS opt_vals
                FROM (
                    SELECT 
                        kv.key AS opt_name,
                        kv.value AS opt_val,
                        count(DISTINCT m.id)::int AS cnt
                    FROM matched m
                    JOIN ${productVariantsTable} pv ON pv.product_id = m.id AND pv.is_active = true
                    CROSS JOIN LATERAL jsonb_each_text(pv.option_values) AS kv(key, value)
                    GROUP BY kv.key, kv.value
                ) grouped_opts
                GROUP BY opt_name
                ORDER BY opt_name ASC
            ) s
        ),
        price_bounds AS (
            SELECT 
                COALESCE(MIN(sell_price), 0)::float AS min_price,
                COALESCE(MAX(sell_price), 0)::float AS max_price
            FROM matched
        )
        SELECT 
            COALESCE((SELECT categories FROM cat_counts), '[]'::json) AS categories,
            COALESCE((SELECT tags FROM tag_counts), '[]'::json) AS tags,
            COALESCE((SELECT options FROM option_facets), '[]'::json) AS options,
            (SELECT json_build_object('min', min_price, 'max', max_price) FROM price_bounds) AS "priceRange";
    `;

    const result = await dbInstance.execute(facetSql);
    const row = (result.rows?.[0] ?? {}) as Record<string, unknown>;

    const parseJsonField = (val: unknown, fallback: unknown) => {
        if (!val) return fallback;
        if (typeof val === "object") return val;
        try {
            return JSON.parse(val as string);
        } catch {
            return fallback;
        }
    };

    const categories = parseJsonField(row.categories, []) as Array<{ id: string; name: string; slug: string; count: number }>;
    const tags = parseJsonField(row.tags, []) as Array<{ name: string; count: number }>;
    const options = parseJsonField(row.options, []) as Array<{ name: string; values: Array<{ value: string; count: number }> }>;
    const priceRange = parseJsonField(row.priceRange, { min: 0, max: 0 }) as { min: number; max: number };

    return ProductFacetsSchema.parse({
        categories,
        tags,
        options,
        priceRange: {
            min: Number(priceRange.min ?? 0),
            max: Number(priceRange.max ?? 0),
        },
    });
};

export const buildProductOrderBy = (
    sortBy: NonNullable<TProductSort["sortBy"]>,
    sortOrder: TProductSort["sortOrder"],
    searchQuery?: SQL | null,
): SQL[] => {
    const direction = sortOrder === "asc" ? asc : desc;

    switch (sortBy) {
        case "relevance":
            if (searchQuery) {
                return [desc(sql`ts_rank(${productsTable.searchVector}, ${searchQuery})`)];
            }
            return [desc(productsTable.createdAt)];
        case "sellPrice":
            return [direction(productsTable.sellPrice)];
        case "name":
            return [direction(sql`lower(${productsTable.name})`)];
        case "publishedAt":
            return [direction(productsTable.publishedAt), direction(productsTable.createdAt)];
        case "createdAt":
        default:
            return [direction(productsTable.createdAt)];
    }
};

export const parseProductQuery = <TSchema extends z.ZodTypeAny>(
    url: URL,
    schema: TSchema,
): z.infer<TSchema> => {
    const params: Record<string, unknown> = {};
    const options: Record<string, string> = {};

    for (const key of url.searchParams.keys()) {
        const values = url.searchParams.getAll(key);
        if (key.startsWith("option_")) {
            const optName = key.replace(/^option_/, "").trim();
            if (optName && values[0]) {
                options[optName] = values[0].trim();
            }
            continue;
        }

        const match = key.match(/^options\[(.*)\]$/);
        if (match && match[1]) {
            const optName = match[1].trim();
            if (optName && values[0]) {
                options[optName] = values[0].trim();
            }
            continue;
        }

        const paramKey = key === "tag" ? "tags" : key;
        if (paramKey === "tags" || values.length > 1) {
            params[paramKey] = values;
        } else {
            params[paramKey] = values[0];
        }
    }

    if (Object.keys(options).length > 0) {
        params.options = options;
    }

    return schema.parse(params);
};