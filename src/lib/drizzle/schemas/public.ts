import { INVENTORY_TYPES, PRODUCT_STATUSES } from "@/features/products/constants";
import type { TProductImages, TProductTags } from "@/features/products/types";
import { randomUUID } from "crypto";
import { relations, sql, type SQL } from "drizzle-orm";
import {
    type AnyPgColumn,
    boolean,
    customType,
    index,
    integer,
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

export const variantTypesTable = pgTable("variant_types", {
    id: uuid().primaryKey().$default(randomUUID),
    name: text().notNull(),
    code: text().notNull().unique(),
    description: text().notNull().default(""),
    defaultInventoryType: inventoryTypeEnum("default_inventory_type").notNull().default("discrete"),
    position: integer().notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
}, (table) => [
    index("variant_types_code_idx").on(table.code),
    index("variant_types_position_idx").on(table.position),
    index("variant_types_is_active_idx").on(table.isActive),
]);

export const variantTypeValuesTable = pgTable("variant_type_values", {
    id: uuid().primaryKey().$default(randomUUID),
    variantTypeId: uuid("variant_type_id").notNull().references(() => variantTypesTable.id, { onDelete: "cascade" }),
    value: text().notNull(),
    position: integer().notNull().default(0),
    swatchMeta: text("swatch_meta"),
    defaultConsumptionRate: numeric("default_consumption_rate", {
        scale: 4,
        mode: "number",
    }),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
}, (table) => [
    unique("variant_type_values_variant_type_value_unique").on(table.variantTypeId, table.value),
    index("variant_type_values_variant_type_id_idx").on(table.variantTypeId),
    index("variant_type_values_position_idx").on(table.position),
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
    sellPrice: numeric<"number">({
        scale: 2,
    }).notNull(),
    stock: numeric<"number">({
        scale: 2,
    }).notNull().default(0),
    poolStock: numeric("pool_stock", {
        scale: 4,
        mode: "number",
    }).notNull().default(0),
    inventoryType: inventoryTypeEnum("inventory_type").notNull().default("discrete"),
    allowBackorder: boolean("allow_backorder").notNull().default(false),
    weight: numeric("weight", { precision: 10, scale: 3, mode: "number" }),
    packageLength: numeric("package_length", { precision: 10, scale: 2, mode: "number" }),
    packageWidth: numeric("package_width", { precision: 10, scale: 2, mode: "number" }),
    packageHeight: numeric("package_height", { precision: 10, scale: 2, mode: "number" }),
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
    index("products_pool_stock_idx").on(table.poolStock),
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

export const productOptionsTable = pgTable("product_options", {
    id: uuid().primaryKey().$default(randomUUID),
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    variantTypeId: uuid("variant_type_id").references((): AnyPgColumn => variantTypesTable.id, { onDelete: "set null" }),
    name: text().notNull(),
    position: integer().notNull().default(0),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
}, (table) => [
    unique("product_options_product_name_unique").on(table.productId, table.name),
    index("product_options_product_id_idx").on(table.productId),
    index("product_options_variant_type_id_idx").on(table.variantTypeId),
]);

export const productOptionValuesTable = pgTable("product_option_values", {
    id: uuid().primaryKey().$default(randomUUID),
    optionId: uuid("option_id").notNull().references(() => productOptionsTable.id, { onDelete: "cascade" }),
    value: text().notNull(),
    position: integer().notNull().default(0),
    swatchMeta: text("swatch_meta"),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
}, (table) => [
    unique("product_option_values_option_value_unique").on(table.optionId, table.value),
    index("product_option_values_option_id_idx").on(table.optionId),
]);

export const productVariantsTable = pgTable("product_variants", {
    id: uuid().primaryKey().$default(randomUUID),
    productId: uuid("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
    title: text().notNull(),
    sku: text().notNull().unique(),
    optionValues: jsonb("option_values").$type<Record<string, string>>().notNull().default({}),
    signature: text().notNull(),
    inventoryType: inventoryTypeEnum("inventory_type"),
    allowBackorder: boolean("allow_backorder"),
    purchasePrice: numeric<"number">({
        scale: 2,
    }).notNull(),
    sellPrice: numeric<"number">({
        scale: 2,
    }).notNull(),
    stock: numeric<"number">({
        scale: 2,
    }).notNull().default(0),
    poolConsumptionRate: numeric("pool_consumption_rate", {
        scale: 4,
        mode: "number",
    }),
    weight: numeric("weight", { precision: 10, scale: 3, mode: "number" }),
    packageLength: numeric("package_length", { precision: 10, scale: 2, mode: "number" }),
    packageWidth: numeric("package_width", { precision: 10, scale: 2, mode: "number" }),
    packageHeight: numeric("package_height", { precision: 10, scale: 2, mode: "number" }),
    isDefault: boolean("is_default").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    imageUrl: text(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp().defaultNow()
        .$onUpdate(() => /* @__PURE__ */ new Date())
        .notNull(),
    deletedAt: timestamp(),
}, (table) => [
    unique("product_variants_product_signature_unique").on(table.productId, table.signature),
    index("product_variants_product_id_idx").on(table.productId),
    index("product_variants_sku_idx").on(table.sku),
    index("product_variants_inventory_type_idx").on(table.inventoryType),
    index("product_variants_product_active_idx").on(table.productId, table.isActive),
    index("product_variants_deleted_at_idx").on(table.deletedAt),
    index("product_variants_option_values_idx").using("gin", table.optionValues),
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

export const variantTypesRelations = relations(variantTypesTable, ({ many }) => ({
    values: many(variantTypeValuesTable),
    productOptions: many(productOptionsTable),
}));

export const variantTypeValuesRelations = relations(variantTypeValuesTable, ({ one }) => ({
    variantType: one(variantTypesTable, {
        fields: [variantTypeValuesTable.variantTypeId],
        references: [variantTypesTable.id],
    }),
}));

export const productOptionsRelations = relations(productOptionsTable, ({ one, many }) => ({
    product: one(productsTable, {
        fields: [productOptionsTable.productId],
        references: [productsTable.id],
    }),
    variantType: one(variantTypesTable, {
        fields: [productOptionsTable.variantTypeId],
        references: [variantTypesTable.id],
    }),
    values: many(productOptionValuesTable),
}));

export const productOptionValuesRelations = relations(productOptionValuesTable, ({ one }) => ({
    option: one(productOptionsTable, {
        fields: [productOptionValuesTable.optionId],
        references: [productOptionsTable.id],
    }),
}));

export const productsRelations = relations(productsTable, ({ many }) => ({
    productCategories: many(productCategoriesTable),
    variants: many(productVariantsTable),
    options: many(productOptionsTable),
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