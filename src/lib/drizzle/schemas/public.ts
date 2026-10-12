import { INVENTORY_TYPES, PRODUCT_STATUSES, WEIGHT_UNITS } from "@/features/products/constants";
import type { TProductImages, TProductTags } from "@/features/products/types";
import { randomUUID } from "crypto";
import { relations, sql, type SQL } from "drizzle-orm";
import {
    type AnyPgColumn,
    boolean,
    customType,
    index,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    primaryKey,
    text,
    timestamp,
    unique,
    uuid,
} from "drizzle-orm/pg-core";

export const productStatusEnum = pgEnum("product_status", PRODUCT_STATUSES);
export const weightUnitEnum = pgEnum("weight_unit", WEIGHT_UNITS);
export const inventoryTypeEnum = pgEnum("inventory_type", INVENTORY_TYPES);

export const tsvector = customType<{ data: string }>({
    dataType() {
        return "tsvector";
    },
});

export const categoriesTable = pgTable("categories", {
    id: uuid().primaryKey().$default(randomUUID),
    name: text().notNull(),
    slug: text().notNull().unique(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categoriesTable.id, { onDelete: "set null" }),
    description: text().notNull().default(""),
    imageUrl: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
}, (table) => [
    index("categories_slug_idx").on(table.slug),
    index("categories_parent_id_idx").on(table.parentId),
    index("categories_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
]);

export const productsTable = pgTable("products", {
    id: uuid().primaryKey().$default(randomUUID),
    name: text().notNull(),
    slug: text().notNull().unique(),
    shortDescription: text().notNull().default(""),
    description: text().notNull().default(""),
    tags: jsonb().$type<TProductTags>().notNull().default([]),
    featuredImageUrl: text().notNull(),
    images: jsonb().$type<TProductImages>().notNull().default([]),
    purchasePrice: numeric<"number">({
        scale: 2,
    }).notNull(),
    sellPrice: numeric<"number">({
        scale: 2,
    }).notNull(),
    stock: numeric<"number">({
        scale: 2,
    }).notNull().default(0),
    inventoryType: inventoryTypeEnum("inventory_type").notNull().default("discrete"),
    baseWeightUnit: weightUnitEnum("base_weight_unit"),
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
                    coalesce("shortDescription", '')
                ),
                'B'
            )
            ||
            setweight(
                to_tsvector(
                    'english',
                    coalesce("description", '')
                ),
                'C'
            )
        `
    ),
}, (table) => [
    index("products_status_idx").on(table.status),
    index("products_inventory_type_idx").on(table.inventoryType),
    index("products_published_at_idx").on(table.publishedAt),
    index("products_sell_price_idx").on(table.sellPrice),
    index("products_deleted_at_idx").on(table.deletedAt),
    index("products_tags_idx").using("gin", table.tags),
    index("products_search_vector_idx").using("gin", table.searchVector),
    index("products_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
]);

export const productCategoriesTable = pgTable("product_categories", {
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").notNull().references(() => categoriesTable.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(false),
    createdAt: timestamp().defaultNow().notNull(),
}, (table) => [
    primaryKey({ columns: [table.productId, table.categoryId] }),
    index("product_categories_product_id_idx").on(table.productId),
    index("product_categories_category_id_idx").on(table.categoryId),
]);

export const productVariantsTable = pgTable("product_variants", {
    id: uuid().primaryKey().$default(randomUUID),
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    title: text().notNull(),
    weightValue: numeric<"number">({
        scale: 2,
    }).notNull(),
    weightUnit: weightUnitEnum("weight_unit").notNull(),
    sku: text().notNull().unique(),
    purchasePrice: numeric<"number">({
        scale: 2,
    }).notNull(),
    sellPrice: numeric<"number">({
        scale: 2,
    }).notNull(),
    stock: numeric<"number">({
        scale: 2,
    }).notNull().default(0),
    poolConsumptionRate: numeric<"number">({
        scale: 4,
    }),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    imageUrl: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
}, (table) => [
    unique("product_variants_product_weight_unique").on(table.productId, table.weightValue, table.weightUnit),
    index("product_variants_product_id_idx").on(table.productId),
    index("product_variants_sku_idx").on(table.sku),
    index("product_variants_product_active_idx").on(table.productId, table.isActive),
]);

export const productSlugRedirectsTable = pgTable("product_slug_redirects", {
    id: uuid().primaryKey().$default(randomUUID),
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    sourceSlug: text("source_slug").notNull().unique(),
    targetSlug: text("target_slug").notNull(),
    createdAt: timestamp().defaultNow().notNull(),
}, (table) => [
    index("product_slug_redirects_product_id_idx").on(table.productId),
    index("product_slug_redirects_source_slug_idx").on(table.sourceSlug),
    index("product_slug_redirects_target_slug_idx").on(table.targetSlug),
]);

export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
    parent: one(categoriesTable, {
        fields: [categoriesTable.parentId],
        references: [categoriesTable.id],
        relationName: "categoryHierarchy",
    }),
    children: many(categoriesTable, {
        relationName: "categoryHierarchy",
    }),
    productCategories: many(productCategoriesTable),
}));

export const productsRelations = relations(productsTable, ({ many }) => ({
    productCategories: many(productCategoriesTable),
    variants: many(productVariantsTable),
    slugRedirects: many(productSlugRedirectsTable),
}));

export const productVariantsRelations = relations(productVariantsTable, ({ one }) => ({
    product: one(productsTable, {
        fields: [productVariantsTable.productId],
        references: [productsTable.id],
    }),
}));

export const productSlugRedirectsRelations = relations(productSlugRedirectsTable, ({ one }) => ({
    product: one(productsTable, {
        fields: [productSlugRedirectsTable.productId],
        references: [productsTable.id],
    }),
}));

export const productCategoriesRelations = relations(productCategoriesTable, ({ one }) => ({
    product: one(productsTable, {
        fields: [productCategoriesTable.productId],
        references: [productsTable.id],
    }),
    category: one(categoriesTable, {
        fields: [productCategoriesTable.categoryId],
        references: [categoriesTable.id],
    }),
}));