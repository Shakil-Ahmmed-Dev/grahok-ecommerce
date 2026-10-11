import { and, asc, desc, eq, gt, gte, isNull, lte, sql, type SQL } from "drizzle-orm";
import z from "zod";
import { productsTable } from "@/lib/drizzle/schemas/public";
import type { TProductSort } from "./types";

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