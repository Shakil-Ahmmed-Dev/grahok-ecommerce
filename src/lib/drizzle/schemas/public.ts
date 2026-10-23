import { INVENTORY_TYPES, PRODUCT_STATUSES } from "@/features/products/constants";
import type { TProductImages, TProductTags, TVariantCheckoutSnapshot } from "@/features/products/types";
import { user } from "@/lib/drizzle/schemas/auth";
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
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

/* ==========================================================================
   Customer Enums & Constants
   ========================================================================== */

export const CUSTOMER_TYPES = ["registered", "guest"] as const;
export const customerTypeEnum = pgEnum("customer_type", CUSTOMER_TYPES);

export const CUSTOMER_STATUSES = ["active", "suspended", "archived"] as const;
export const customerStatusEnum = pgEnum("customer_status", CUSTOMER_STATUSES);

export const ADDRESS_TYPES = ["shipping", "billing", "both"] as const;
export const addressTypeEnum = pgEnum("address_type", ADDRESS_TYPES);

export const CUSTOMER_AUDIT_ACTOR_TYPES = ["customer", "admin", "system"] as const;
export type TCustomerAuditActorType = (typeof CUSTOMER_AUDIT_ACTOR_TYPES)[number];

export const CUSTOMER_AUDIT_ACTIONS = [
    "profile_updated",
    "address_created",
    "address_updated",
    "address_deleted",
    "default_address_changed",
    "anonymization_requested",
    "customer_anonymized",
    "data_exported",
    "admin_note_added",
    "risk_score_adjusted",
    "order_placed",
    "order_cancelled",
] as const;
export type TCustomerAuditAction = (typeof CUSTOMER_AUDIT_ACTIONS)[number];

/* ==========================================================================
   Order & Checkout Enums & Types
   ========================================================================== */

export const ORDER_STATUSES = [
    "pending",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
    "refunded",
] as const;
export type TOrderStatus = (typeof ORDER_STATUSES)[number];
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);

export const PAYMENT_STATUSES = ["pending", "paid", "failed", "refunded"] as const;
export type TPaymentStatus = (typeof PAYMENT_STATUSES)[number];
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUSES);

export const PAYMENT_METHODS = ["cod", "card", "manual"] as const;
export type TPaymentMethod = (typeof PAYMENT_METHODS)[number];
export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);

export interface TCheckoutAddressSnapshot {
    recipientName: string;
    company?: string | null;
    phone: string;
    addressLine1: string;
    addressLine2?: string | null;
    city: string;
    state?: string | null;
    postalCode: string;
    countryCode: string;
}

export interface TConsignmentLogisticsSnapshot {
    totalActualWeight: number;
    totalVolumeCm3: number;
    aggregateVolumetricWeight: number;
    chargeableWeight: number;
    pieceChargeableWeight: number;
    hasPhysicalGoods: boolean;
}

/* ==========================================================================
   Product Enums & Types
   ========================================================================== */

export const productStatusEnum = pgEnum("product_status", PRODUCT_STATUSES);
export const inventoryTypeEnum = pgEnum("inventory_type", INVENTORY_TYPES);

export const tsvector = customType<{ data: string }>({
    dataType() {
        return "tsvector";
    },
});

/* ==========================================================================
   Customer Tables
   ========================================================================== */

export const customersTable = pgTable(
    "customers",
    {
        id: uuid().primaryKey().$default(randomUUID),
        authUserId: text("auth_user_id")
            .references(() => user.id, { onDelete: "set null" })
            .unique(),
        customerType: customerTypeEnum("customer_type").notNull().default("registered"),
        status: customerStatusEnum("status").notNull().default("active"),
        email: text().notNull(),
        firstName: text("first_name"),
        lastName: text("last_name"),
        phone: text("phone"),
        avatarUrl: text("avatar_url"),
        riskScore: integer("risk_score").notNull().default(0),
        adminNotes: text("admin_notes"),
        tags: jsonb("tags").$type<string[]>().notNull().default([]),
        metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
        totalOrders: integer("total_orders").notNull().default(0),
        totalSpent: numeric("total_spent", { scale: 2 }).notNull().default("0.00"),
        lastOrderAt: timestamp("last_order_at"),
        isAnonymized: boolean("is_anonymized").notNull().default(false),
        anonymizedAt: timestamp("anonymized_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        deletedAt: timestamp("deleted_at"),
    },
    (table) => [
        index("customers_email_idx").on(table.email),
        index("customers_auth_user_id_idx").on(table.authUserId),
        index("customers_status_type_created_idx").on(table.status, table.customerType, table.createdAt),
        index("customers_deleted_at_idx").on(table.deletedAt),
        index("customers_email_trgm_idx").using("gin", table.email.op("gin_trgm_ops")),
        index("customers_first_name_trgm_idx").using("gin", table.firstName.op("gin_trgm_ops")),
        index("customers_last_name_trgm_idx").using("gin", table.lastName.op("gin_trgm_ops")),
        index("customers_phone_trgm_idx").using("gin", table.phone.op("gin_trgm_ops")),
    ]
);

export const customerAddressesTable = pgTable(
    "customer_addresses",
    {
        id: uuid().primaryKey().$default(randomUUID),
        customerId: uuid("customer_id")
            .notNull()
            .references(() => customersTable.id, { onDelete: "cascade" }),
        recipientName: text("recipient_name").notNull(),
        company: text("company"),
        phone: text("phone").notNull(),
        addressLine1: text("address_line1").notNull(),
        addressLine2: text("address_line2"),
        city: text("city").notNull(),
        state: text("state"),
        postalCode: text("postal_code").notNull(),
        countryCode: text("country_code").notNull(),
        addressType: addressTypeEnum("address_type").notNull().default("both"),
        isDefaultShipping: boolean("is_default_shipping").notNull().default(false),
        isDefaultBilling: boolean("is_default_billing").notNull().default(false),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
        deletedAt: timestamp("deleted_at"),
    },
    (table) => [
        index("customer_addresses_customer_id_idx").on(table.customerId),
        index("customer_addresses_deleted_at_idx").on(table.deletedAt),
        uniqueIndex("customer_addresses_unique_default_shipping")
            .on(table.customerId)
            .where(sql`${table.isDefaultShipping} = true AND ${table.deletedAt} IS NULL`),
        uniqueIndex("customer_addresses_unique_default_billing")
            .on(table.customerId)
            .where(sql`${table.isDefaultBilling} = true AND ${table.deletedAt} IS NULL`),
    ]
);

export const customerAuditLogsTable = pgTable(
    "customer_audit_logs",
    {
        id: uuid().primaryKey().$default(randomUUID),
        customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
        actorId: text("actor_id"),
        actorType: text("actor_type").notNull().default("customer"),
        action: text("action").notNull(),
        changes: jsonb("changes").$type<Record<string, unknown>>().notNull().default({}),
        ipAddress: text("ip_address"),
        userAgent: text("user_agent"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("customer_audit_logs_customer_created_idx").on(table.customerId, table.createdAt),
        index("customer_audit_logs_action_idx").on(table.action),
        index("customer_audit_logs_actor_id_idx").on(table.actorId),
        index("customer_audit_logs_created_at_idx").on(table.createdAt),
    ]
);

/* ==========================================================================
   Product & Category Tables
   ========================================================================== */

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
        mode: "number",
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

/* ==========================================================================
   Order & Checkout Tables
   ========================================================================== */

export const ordersTable = pgTable(
    "orders",
    {
        id: uuid().primaryKey().$default(randomUUID),
        orderNumber: text("order_number").notNull().unique(),
        customerId: uuid("customer_id").references(() => customersTable.id, { onDelete: "set null" }),
        customerType: customerTypeEnum("customer_type").notNull().default("registered"),
        customerEmail: text("customer_email").notNull(),
        customerName: text("customer_name"),
        customerPhone: text("customer_phone"),
        status: orderStatusEnum("status").notNull().default("pending"),
        paymentStatus: paymentStatusEnum("payment_status").notNull().default("pending"),
        paymentMethod: paymentMethodEnum("payment_method").notNull().default("cod"),
        currency: text("currency").notNull().default("USD"),
        subtotal: numeric("subtotal", { scale: 2 }).notNull(),
        shippingFee: numeric("shipping_fee", { scale: 2 }).notNull().default("0.00"),
        tax: numeric("tax", { scale: 2 }).notNull().default("0.00"),
        discount: numeric("discount", { scale: 2 }).notNull().default("0.00"),
        totalAmount: numeric("total_amount", { scale: 2 }).notNull(),
        shippingAddress: jsonb("shipping_address").$type<TCheckoutAddressSnapshot>().notNull(),
        billingAddress: jsonb("billing_address").$type<TCheckoutAddressSnapshot>().notNull(),
        logistics: jsonb("logistics").$type<TConsignmentLogisticsSnapshot>(),
        notes: text("notes"),
        metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
        guestAccessTokenHash: text("guest_access_token_hash"),
        cancelledAt: timestamp("cancelled_at"),
        paidAt: timestamp("paid_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at")
            .defaultNow()
            .$onUpdate(() => /* @__PURE__ */ new Date())
            .notNull(),
    },
    (table) => [
        index("orders_customer_id_idx").on(table.customerId),
        index("orders_order_number_idx").on(table.orderNumber),
        index("orders_customer_email_idx").on(table.customerEmail),
        index("orders_status_idx").on(table.status),
        index("orders_created_at_idx").on(table.createdAt),
    ]
);

export const orderItemsTable = pgTable(
    "order_items",
    {
        id: uuid().primaryKey().$default(randomUUID),
        orderId: uuid("order_id")
            .notNull()
            .references(() => ordersTable.id, { onDelete: "cascade" }),
        productId: uuid("product_id").references(() => productsTable.id, { onDelete: "set null" }),
        variantId: uuid("variant_id").references(() => productVariantsTable.id, { onDelete: "set null" }),
        title: text("title").notNull(),
        variantTitle: text("variant_title").notNull(),
        sku: text("sku").notNull(),
        slug: text("slug"),
        imageUrl: text("image_url"),
        unitPrice: numeric("unit_price", { scale: 2 }).notNull(),
        quantity: integer("quantity").notNull(),
        totalPrice: numeric("total_price", { scale: 2 }).notNull(),
        weight: numeric("weight", { precision: 10, scale: 3, mode: "number" }),
        isBackordered: boolean("is_backordered").notNull().default(false),
        snapshot: jsonb("snapshot").$type<TVariantCheckoutSnapshot>(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (table) => [
        index("order_items_order_id_idx").on(table.orderId),
        index("order_items_product_id_idx").on(table.productId),
        index("order_items_variant_id_idx").on(table.variantId),
        index("order_items_sku_idx").on(table.sku),
    ]
);

/* ==========================================================================
   Relations
   ========================================================================== */

export const customersRelations = relations(customersTable, ({ one, many }) => ({
    user: one(user, {
        fields: [customersTable.authUserId],
        references: [user.id],
    }),
    addresses: many(customerAddressesTable),
    auditLogs: many(customerAuditLogsTable),
    orders: many(ordersTable),
}));

export const customerAddressesRelations = relations(customerAddressesTable, ({ one }) => ({
    customer: one(customersTable, {
        fields: [customerAddressesTable.customerId],
        references: [customersTable.id],
    }),
}));

export const customerAuditLogsRelations = relations(customerAuditLogsTable, ({ one }) => ({
    customer: one(customersTable, {
        fields: [customerAuditLogsTable.customerId],
        references: [customersTable.id],
    }),
}));

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

export const ordersRelations = relations(ordersTable, ({ one, many }) => ({
    customer: one(customersTable, {
        fields: [ordersTable.customerId],
        references: [customersTable.id],
    }),
    items: many(orderItemsTable),
}));

export const orderItemsRelations = relations(orderItemsTable, ({ one }) => ({
    order: one(ordersTable, {
        fields: [orderItemsTable.orderId],
        references: [ordersTable.id],
    }),
    product: one(productsTable, {
        fields: [orderItemsTable.productId],
        references: [productsTable.id],
    }),
    variant: one(productVariantsTable, {
        fields: [orderItemsTable.variantId],
        references: [productVariantsTable.id],
    }),
}));
