import type { TProductImages, TProductTags } from "@/features/products/types";
import { randomUUID } from "crypto";
import { sql, type SQL } from "drizzle-orm";
import { boolean, customType, index, jsonb, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const tsvector = customType<{ data: string }>({
    dataType() {
        return "tsvector";
    },
});

export const productsTable = pgTable("products", {
    id: uuid().primaryKey().$default(randomUUID),
    name: text().notNull(),
    slug: text().notNull().unique(),
    category: text().notNull().default("Uncategorized"),
    subcategory: text().notNull().default("Uncategorized"),
    tags: jsonb().$type<TProductTags>().notNull().default([]),
    featuredImageUrl: text().notNull(),
    images: jsonb().$type<TProductImages>().notNull().default([]),
    purchasePrice: numeric<"number">({
        scale: 2
    }).notNull(),
    sellPrice: numeric<"number">({
        scale: 2
    }).notNull(),
    stock: numeric<"number">({
        scale: 2
    }).notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
    deletedAt: timestamp(),
    searchVector: tsvector("search_vector").generatedAlwaysAs(
        (): SQL => sql`
            setweight(
                to_tsvector(
                    'english',
                    coalesce("name", '')
                ),
                'A'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("category", '')
                ),
                'B'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("subcategory", '')
                ),
                'C'
            )
        `
    ),
}, (table) => [
    index("products_is_active_created_at_idx").on(table.isActive, table.createdAt),
    index("products_category_idx").on(table.category),
    index("products_subcategory_idx").on(table.subcategory),
    index("products_sell_price_idx").on(table.sellPrice),
    index("products_deleted_at_idx").on(table.deletedAt),
    index("products_tags_idx").using("gin", table.tags),
    index("products_search_vector_idx").using("gin", table.searchVector),
]);