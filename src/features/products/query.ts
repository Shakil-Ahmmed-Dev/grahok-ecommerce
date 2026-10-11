import { and, asc, desc, eq, gt, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import z from "zod";
import { productsTable } from "@/lib/drizzle/schemas/public";
import { db } from "@/lib/drizzle";
import { ProductFacetsSchema, type TProductFacets, type TProductSort } from "./types";

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
    subcategory?: string;
    tags?: string[];
    minPrice?: number;
    maxPrice?: number;
    inStock?: boolean;
    isActive?: boolean;
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
): SQL | undefined => {
    const conditions: SQL[] = [];

    if (mode === "public") {
        conditions.push(eq(productsTable.isActive, true));
        conditions.push(isNull(productsTable.deletedAt));
    } else {
        if (query.isActive !== undefined) {
            conditions.push(eq(productsTable.isActive, query.isActive));
        }
        if (!query.includeDeleted) {
            conditions.push(isNull(productsTable.deletedAt));
        }
    }

    if (searchQuery) {
        conditions.push(sql`${productsTable.searchVector} @@ ${searchQuery}`);
    }

    if (cursorCondition) {
        conditions.push(cursorCondition);
    }

    if (query.category) {
        conditions.push(eq(productsTable.category, query.category));
    }

    if (query.subcategory) {
        conditions.push(eq(productsTable.subcategory, query.subcategory));
    }

    if (query.tags && query.tags.length > 0) {
        conditions.push(sql`${productsTable.tags} ?| ${sql.param(query.tags)}`);
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
                ${productsTable.category} AS category,
                ${productsTable.subcategory} AS subcategory,
                ${productsTable.tags} AS tags,
                ${productsTable.sellPrice} AS sell_price
            FROM ${productsTable}
            ${whereClause}
        ),
        cat_counts AS (
            SELECT json_agg(json_build_object('name', category, 'count', c)) AS categories
            FROM (
                SELECT category, count(*)::int AS c
                FROM matched
                GROUP BY category
                ORDER BY c DESC
                LIMIT 20
            ) s
        ),
        subcat_counts AS (
            SELECT json_agg(json_build_object('name', subcategory, 'count', c)) AS subcategories
            FROM (
                SELECT subcategory, count(*)::int AS c
                FROM matched
                GROUP BY subcategory
                ORDER BY c DESC
                LIMIT 20
            ) s
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
        price_bounds AS (
            SELECT 
                COALESCE(MIN(sell_price), 0)::float AS min_price,
                COALESCE(MAX(sell_price), 0)::float AS max_price
            FROM matched
        )
        SELECT 
            COALESCE((SELECT categories FROM cat_counts), '[]'::json) AS categories,
            COALESCE((SELECT subcategories FROM subcat_counts), '[]'::json) AS subcategories,
            COALESCE((SELECT tags FROM tag_counts), '[]'::json) AS tags,
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

    const categories = parseJsonField(row.categories, []) as Array<{ name: string; count: number }>;
    const subcategories = parseJsonField(row.subcategories, []) as Array<{ name: string; count: number }>;
    const tags = parseJsonField(row.tags, []) as Array<{ name: string; count: number }>;
    const priceRange = parseJsonField(row.priceRange, { min: 0, max: 0 }) as { min: number; max: number };

    return ProductFacetsSchema.parse({
        categories,
        subcategories,
        tags,
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
        case "createdAt":
        default:
            return [direction(productsTable.createdAt)];
    }
};

export const parseProductQuery = <TSchema extends z.ZodTypeAny>(
    url: URL,
    schema: TSchema,
): z.infer<TSchema> => {
    const params: Record<string, string | string[]> = {};

    for (const key of url.searchParams.keys()) {
        const values = url.searchParams.getAll(key);
        const paramKey = key === "tag" ? "tags" : key;
        if (paramKey === "tags" || values.length > 1) {
            params[paramKey] = values;
        } else {
            params[paramKey] = values[0];
        }
    }

    return schema.parse(params);
};