import { PRODUCT_STATUSES } from "@/features/products/constants";
import type { TProductImages, TProductTags } from "@/features/products/types";
import { randomUUID } from "crypto";
import { sql, type SQL } from "drizzle-orm";
import { customType, index, jsonb, numeric, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const productStatusEnum = pgEnum("product_status", PRODUCT_STATUSES);

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
    shortDescription: text().notNull().default(""),
    description: text().notNull().default(""),
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
    status: productStatusEnum().notNull().default(PRODUCT_STATUSES[0]),
    publishedAt: timestamp(),
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
                    coalesce("category", '') || ' ' || coalesce("subcategory", '')
                ),
                'B'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("shortDescription", '')
                ),
                'C'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("description", '')
                ),
                'D'
            )
        `
    ),
}, (table) => [
    index("products_status_idx").on(table.status),
    index("products_published_at_idx").on(table.publishedAt),
    index("products_category_idx").on(table.category),
    index("products_subcategory_idx").on(table.subcategory),
    index("products_sell_price_idx").on(table.sellPrice),
    index("products_deleted_at_idx").on(table.deletedAt),
    index("products_tags_idx").using("gin", table.tags),
    index("products_search_vector_idx").using("gin", table.searchVector),
]);