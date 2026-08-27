import { and, asc, desc, eq, gt, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
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
}

export const buildProductConditions = (
    query: TProductFilterFields,
    mode: "public" | "admin",
): SQL | undefined => {
    const conditions: SQL[] = [];

    if (mode === "public") {
        conditions.push(eq(productsTable.isActive, true));
    } else if (query.isActive !== undefined) {
        conditions.push(eq(productsTable.isActive, query.isActive));
    }

    if (query.search) {
        conditions.push(or(
            ilike(productsTable.name, `%${query.search}%`),
            ilike(productsTable.slug, `%${query.search}%`),
        ) as SQL);
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
    sortBy: TProductSort["sortBy"],
    sortOrder: TProductSort["sortOrder"],
): SQL[] => {
    const direction = sortOrder === "asc" ? asc : desc;

    switch (sortBy) {
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