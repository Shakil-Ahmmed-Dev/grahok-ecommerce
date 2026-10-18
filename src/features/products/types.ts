import {
    productOptionsTable,
    productOptionValuesTable,
    productsTable,
    productSlugRedirectsTable,
    productVariantsTable,
    variantTypesTable,
    variantTypeValuesTable,
} from "@/lib/drizzle/schemas/public";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";
import { INVENTORY_TYPES, PRODUCT_STATUSES } from "./constants";

export const ProductTagSchema = z.string().trim().min(1, "Tag cannot be empty");
export type TProductTag = z.infer<typeof ProductTagSchema>;

export const ProductTagsSchema = z.array(ProductTagSchema);
export type TProductTags = z.infer<typeof ProductTagsSchema>;

export const ProductImageSchema = z.url("Image URL must be a valid URL").trim().min(1, "Image URL cannot be empty");
export type TProductImage = z.infer<typeof ProductImageSchema>;

export const ProductImagesSchema = z.array(ProductImageSchema);
export type TProductImages = z.infer<typeof ProductImagesSchema>;

export const ProductSlugSchema = z.string().trim().min(1, "Product slug is required");
export type TProductSlug = z.infer<typeof ProductSlugSchema>;

export const ProductStatusSchema = z.enum(PRODUCT_STATUSES);
export type TProductStatus = z.infer<typeof ProductStatusSchema>;

export const InventoryTypeSchema = z.enum(INVENTORY_TYPES);
export type TInventoryType = z.infer<typeof InventoryTypeSchema>;

export const VariantTypeModelSchema = createSelectSchema(variantTypesTable);
export type TVariantTypeModel = z.infer<typeof VariantTypeModelSchema>;

export const VariantTypeValueModelSchema = createSelectSchema(variantTypeValuesTable);
export type TVariantTypeValueModel = z.infer<typeof VariantTypeValueModelSchema>;

export const VariantTypeValueSchema = z.object({
    id: z.string(),
    variantTypeId: z.string(),
    value: z.string(),
    position: z.number().int().default(0),
    swatchMeta: z.string().nullable().optional(),
    defaultConsumptionRate: z.number().positive().nullable().optional(),
    createdAt: z.date().or(z.string()).optional(),
    updatedAt: z.date().or(z.string()).optional(),
});
export type TVariantTypeValue = z.infer<typeof VariantTypeValueSchema>;

export const VariantTypeSchema = z.object({
    id: z.string(),
    name: z.string(),
    code: z.string(),
    description: z.string().default(""),
    defaultInventoryType: InventoryTypeSchema.default("discrete"),
    position: z.number().int().default(0),
    isActive: z.boolean().default(true),
    values: z.array(VariantTypeValueSchema).default([]),
    createdAt: z.date().or(z.string()).optional(),
    updatedAt: z.date().or(z.string()).optional(),
});
export type TVariantType = z.infer<typeof VariantTypeSchema>;

export const CreateVariantTypeValueSchema = z.object({
    value: z.string().trim().min(1, "Value is required"),
    position: z.number().int().nonnegative().default(0),
    swatchMeta: z.string().trim().nullable().optional(),
    defaultConsumptionRate: z.coerce.number().positive("Consumption rate must be greater than 0").nullable().optional(),
});
export type TCreateVariantTypeValueInput = z.infer<typeof CreateVariantTypeValueSchema>;

export const UpdateVariantTypeValueSchema = CreateVariantTypeValueSchema.partial().extend({
    id: z.string().optional(),
});
export type TUpdateVariantTypeValueInput = z.infer<typeof UpdateVariantTypeValueSchema>;

export const CreateVariantTypeSchema = z.object({
    name: z.string().trim().min(1, "Name is required"),
    code: z.string().trim().min(1, "Code is required").toLowerCase(),
    description: z.string().trim().optional(),
    defaultInventoryType: InventoryTypeSchema.default("discrete"),
    position: z.number().int().nonnegative().default(0),
    isActive: z.boolean().default(true),
    values: z.array(CreateVariantTypeValueSchema).optional(),
});
export type TCreateVariantTypeInput = z.infer<typeof CreateVariantTypeSchema>;

export const UpdateVariantTypeSchema = z.object({
    name: z.string().trim().min(1).optional(),
    code: z.string().trim().min(1).toLowerCase().optional(),
    description: z.string().trim().optional(),
    defaultInventoryType: InventoryTypeSchema.optional(),
    position: z.number().int().nonnegative().optional(),
    isActive: z.boolean().optional(),
    values: z.array(UpdateVariantTypeValueSchema).optional(),
});
export type TUpdateVariantTypeInput = z.infer<typeof UpdateVariantTypeSchema>;

export const ProductOptionModelSchema = createSelectSchema(productOptionsTable);
export type TProductOptionModel = z.infer<typeof ProductOptionModelSchema>;

export const ProductOptionValueModelSchema = createSelectSchema(productOptionValuesTable);
export type TProductOptionValueModel = z.infer<typeof ProductOptionValueModelSchema>;

export const OptionValueItemSchema = z.object({
    id: z.string(),
    optionId: z.string().optional(),
    value: z.string(),
    position: z.number().default(0),
    swatchMeta: z.string().nullable().optional(),
});
export type TOptionValueItem = z.infer<typeof OptionValueItemSchema>;

export const ProductOptionItemSchema = z.object({
    id: z.string(),
    productId: z.string().optional(),
    variantTypeId: z.string().nullable().optional(),
    name: z.string(),
    position: z.number().default(0),
    values: z.array(OptionValueItemSchema).default([]),
});
export type TProductOptionItem = z.infer<typeof ProductOptionItemSchema>;

export const CreateOptionValueSchema = z.object({
    value: z.string().trim().min(1, "Value is required"),
    position: z.number().int().nonnegative().default(0),
    swatchMeta: z.string().trim().nullable().optional(),
});
export type TCreateOptionValueInput = z.infer<typeof CreateOptionValueSchema>;

export const UpdateOptionValueSchema = CreateOptionValueSchema.partial();
export type TUpdateOptionValueInput = z.infer<typeof UpdateOptionValueSchema>;

export const CreateProductOptionSchema = z.object({
    name: z.string().trim().min(1, "Option name is required"),
    position: z.number().int().nonnegative().default(0),
    variantTypeId: z.string().uuid("Invalid variant type ID").nullable().optional(),
    values: z.array(CreateOptionValueSchema).default([]),
});
export type TCreateProductOptionInput = z.infer<typeof CreateProductOptionSchema>;

export const UpdateProductOptionSchema = z.object({
    name: z.string().trim().min(1).optional(),
    position: z.number().int().nonnegative().optional(),
    variantTypeId: z.string().uuid("Invalid variant type ID").nullable().optional(),
});
export type TUpdateProductOptionInput = z.infer<typeof UpdateProductOptionSchema>;

export const validateDimensionsRefinement = (data: {
    packageLength?: number | null;
    packageWidth?: number | null;
    packageHeight?: number | null;
}) => {
    const hasL = data.packageLength != null;
    const hasW = data.packageWidth != null;
    const hasH = data.packageHeight != null;
    if (hasL || hasW || hasH) {
        return hasL && hasW && hasH;
    }
    return true;
};

export const LogisticsMetricsInputSchema = z.object({
    weight: z.coerce.number().positive("Weight must be greater than 0").nullable().optional(),
    packageLength: z.coerce.number().positive("Package length must be greater than 0").nullable().optional(),
    packageWidth: z.coerce.number().positive("Package width must be greater than 0").nullable().optional(),
    packageHeight: z.coerce.number().positive("Package height must be greater than 0").nullable().optional(),
}).refine(
    validateDimensionsRefinement,
    { message: "All package dimensions (length, width, height) must be provided together" }
);
export type TLogisticsMetricsInput = z.infer<typeof LogisticsMetricsInputSchema>;

export const GenerateMatrixInputSchema = z.object({
    options: z.array(z.object({
        name: z.string().trim().min(1, "Option name is required"),
        variantTypeId: z.string().uuid().nullable().optional(),
        values: z.array(z.object({
            value: z.string().trim().min(1, "Option value is required"),
            swatchMeta: z.string().trim().nullable().optional(),
            defaultConsumptionRate: z.coerce.number().positive().nullable().optional(),
        })).min(1, "Each option must have at least one value"),
    })).min(1, "At least one option is required"),
    skuPrefix: z.string().trim().optional(),
    preview: z.boolean().default(false),
    defaultSellPrice: z.coerce.number().nonnegative().optional(),
    defaultPurchasePrice: z.coerce.number().nonnegative().optional(),
    defaultStock: z.coerce.number().nonnegative().optional(),
    defaultInventoryType: InventoryTypeSchema.nullable().optional(),
    defaultPoolConsumptionRate: z.coerce.number().positive().nullable().optional(),
    defaultWeight: z.coerce.number().positive("Weight must be greater than 0").nullable().optional(),
    defaultPackageLength: z.coerce.number().positive("Package length must be greater than 0").nullable().optional(),
    defaultPackageWidth: z.coerce.number().positive("Package width must be greater than 0").nullable().optional(),
    defaultPackageHeight: z.coerce.number().positive("Package height must be greater than 0").nullable().optional(),
}).refine(
    (data) => {
        const hasL = data.defaultPackageLength != null;
        const hasW = data.defaultPackageWidth != null;
        const hasH = data.defaultPackageHeight != null;
        if (hasL || hasW || hasH) {
            return hasL && hasW && hasH;
        }
        return true;
    },
    { message: "All default package dimensions (length, width, height) must be provided together" }
);
export type TGenerateMatrixInput = z.infer<typeof GenerateMatrixInputSchema>;

export const OptionValuesMapSchema = z.record(z.string(), z.string());
export type TOptionValuesMap = z.infer<typeof OptionValuesMapSchema>;

export const ProductVariantModelSchema = createSelectSchema(productVariantsTable);
export type TProductVariantModel = z.infer<typeof ProductVariantModelSchema>;

export const ProductSlugRedirectModelSchema = createSelectSchema(productSlugRedirectsTable);
export type TProductSlugRedirectModel = z.infer<typeof ProductSlugRedirectModelSchema>;

export const ProductVariantPublicSchema = z.object({
    id: z.string(),
    productId: z.string(),
    title: z.string(),
    sku: z.string(),
    optionValues: OptionValuesMapSchema.default({}),
    signature: z.string(),
    inventoryType: InventoryTypeSchema,
    allowBackorder: z.boolean().default(false),
    sellPrice: z.number(),
    stock: z.number().nullable(),
    isUnlimited: z.boolean().default(false),
    poolConsumptionRate: z.number().nullable().optional(),
    weight: z.number().nullable().optional(),
    packageLength: z.number().nullable().optional(),
    packageWidth: z.number().nullable().optional(),
    packageHeight: z.number().nullable().optional(),
    isDefault: z.boolean(),
    isActive: z.boolean(),
    imageUrl: z.string().nullable().optional(),
});
export type TProductVariantPublic = z.infer<typeof ProductVariantPublicSchema>;

export const ProductVariantSchema = ProductVariantPublicSchema.extend({
    purchasePrice: z.number(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    deletedAt: z.date().or(z.string()).nullable().optional(),
});
export type TProductVariant = z.infer<typeof ProductVariantSchema>;

export const BaseCreateProductVariantSchema = z.object({
    title: z.string().trim().min(1).optional(),
    sku: z.string().trim().min(1, "SKU cannot be empty").optional(),
    optionValues: OptionValuesMapSchema.default({}),
    signature: z.string().trim().optional(),
    inventoryType: InventoryTypeSchema.nullable().optional(),
    allowBackorder: z.boolean().nullable().optional(),
    purchasePrice: z.coerce.number().nonnegative("Purchase price must be a non-negative number").default(0),
    sellPrice: z.coerce.number().nonnegative("Sell price must be a non-negative number"),
    stock: z.coerce.number().nonnegative("Stock must be a non-negative number").default(0),
    poolConsumptionRate: z.coerce.number().positive("Pool consumption rate must be greater than 0").nullable().optional(),
    weight: z.coerce.number().positive("Weight must be greater than 0").nullable().optional(),
    packageLength: z.coerce.number().positive("Package length must be greater than 0").nullable().optional(),
    packageWidth: z.coerce.number().positive("Package width must be greater than 0").nullable().optional(),
    packageHeight: z.coerce.number().positive("Package height must be greater than 0").nullable().optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    imageUrl: z.url("Image URL must be a valid URL").trim().nullable().optional(),
});

export const CreateProductVariantSchema = BaseCreateProductVariantSchema.refine(
    validateDimensionsRefinement,
    { message: "All package dimensions (length, width, height) must be provided together" }
);
export type TCreateProductVariantInput = z.input<typeof CreateProductVariantSchema>;
export type TCreateProductVariantOutput = z.output<typeof CreateProductVariantSchema>;

export const UpdateProductVariantSchema = BaseCreateProductVariantSchema.partial().refine(
    validateDimensionsRefinement,
    { message: "All package dimensions (length, width, height) must be provided together" }
);
export type TUpdateProductVariantInput = z.input<typeof UpdateProductVariantSchema>;
export type TUpdateProductVariantOutput = z.output<typeof UpdateProductVariantSchema>;

export const VariantIdSchema = z.string().uuid("Invalid variant ID format");
export type TVariantId = z.infer<typeof VariantIdSchema>;
export const VariantCheckoutSnapshotSchema = z.object({
    productId: z.string().uuid(),
    variantId: z.string().uuid(),
    sku: z.string(),
    title: z.string(),
    variantTitle: z.string(),
    slug: z.string(),
    imageUrl: z.string().nullable().optional(),
    currentPrice: z.number(),
    purchasePrice: z.number(),
    weight: z.number().nullable().optional(),
    packageLength: z.number().nullable().optional(),
    packageWidth: z.number().nullable().optional(),
    packageHeight: z.number().nullable().optional(),
    volumetricWeight: z.number().nullable().optional(),
    chargeableWeight: z.number().nullable().optional(),
    inventoryType: InventoryTypeSchema,
    allowBackorder: z.boolean().default(false),
    availableStock: z.number().nullable(),
    isUnlimited: z.boolean(),
    isPurchasable: z.boolean(),
    optionValues: OptionValuesMapSchema.default({}),
    status: ProductStatusSchema,
    isActive: z.boolean(),
});
export type TVariantCheckoutSnapshot = z.infer<typeof VariantCheckoutSnapshotSchema>;

export const VariantCheckoutSnapshotOptionsSchema = z.object({
    requestedQuantity: z.coerce.number().int().positive().optional(),
    onlyActive: z.boolean().optional(),
});
export type TVariantCheckoutSnapshotOptions = z.infer<typeof VariantCheckoutSnapshotOptionsSchema>;

export const ProductCategoryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    isPrimary: z.boolean(),
});
export type TProductCategoryItem = z.infer<typeof ProductCategoryItemSchema>;

export const ProductModelSchema = createSelectSchema(productsTable, {
    inventoryType: InventoryTypeSchema.default(InventoryTypeSchema.enum.discrete),
    allowBackorder: z.boolean().default(false).optional(),
    poolStock: z.coerce.number().nonnegative().default(0),
    weight: z.number().nullable().optional(),
    packageLength: z.number().nullable().optional(),
    packageWidth: z.number().nullable().optional(),
    packageHeight: z.number().nullable().optional(),
});
export type TProductModel = z.infer<typeof ProductModelSchema>;

export const GetProductBaseSchema = ProductModelSchema.omit({
    searchVector: true,
});

export const GetProductSchema = GetProductBaseSchema.extend({
    categories: z.array(ProductCategoryItemSchema).default([]),
    options: z.array(ProductOptionItemSchema).default([]),
    variants: z.array(ProductVariantSchema).default([]),
});
export type TGetProduct = z.infer<typeof GetProductSchema>;

export const GetProductsSchema = GetProductSchema.array();
export type TGetProducts = z.infer<typeof GetProductsSchema>;

export const GetProductPublicBaseSchema = ProductModelSchema.omit({
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    searchVector: true,
});

export const GetProductPublicSchema = GetProductPublicBaseSchema.extend({
    categories: z.array(ProductCategoryItemSchema).default([]),
    options: z.array(ProductOptionItemSchema).default([]),
    variants: z.array(ProductVariantPublicSchema).default([]),
});
export type TGetProductPublic = z.infer<typeof GetProductPublicSchema>;

export const GetProductsPublicSchema = GetProductPublicSchema.array();
export type TGetProductsPublic = z.infer<typeof GetProductsPublicSchema>;

export const CategoryFacetSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    count: z.number().int().nonnegative(),
});
export type TCategoryFacet = z.infer<typeof CategoryFacetSchema>;

export const TagFacetSchema = z.object({
    name: z.string(),
    count: z.number().int().nonnegative(),
});
export type TTagFacet = z.infer<typeof TagFacetSchema>;

export const PriceRangeFacetSchema = z.object({
    min: z.number().nonnegative(),
    max: z.number().nonnegative(),
});
export type TPriceRangeFacet = z.infer<typeof PriceRangeFacetSchema>;

export const OptionFacetValueSchema = z.object({
    value: z.string(),
    count: z.number().int().nonnegative(),
});
export type TOptionFacetValue = z.infer<typeof OptionFacetValueSchema>;

export const OptionFacetSchema = z.object({
    name: z.string(),
    values: z.array(OptionFacetValueSchema),
});
export type TOptionFacet = z.infer<typeof OptionFacetSchema>;

export const ProductFacetsSchema = z.object({
    categories: z.array(CategoryFacetSchema),
    tags: z.array(TagFacetSchema),
    options: z.array(OptionFacetSchema).default([]),
    priceRange: PriceRangeFacetSchema,
});
export type TProductFacets = z.infer<typeof ProductFacetsSchema>;

export const PaginationMetaSchema = z.object({
    page: z.number().int().positive().optional(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative().optional(),
    totalPages: z.number().int().nonnegative().optional(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
    nextCursor: z.string().nullable().optional(),
    prevCursor: z.string().nullable().optional(),
});
export type TPaginationMeta = z.infer<typeof PaginationMetaSchema>;

export const ProductsListSchema = z.object({
    data: GetProductsPublicSchema,
    meta: PaginationMetaSchema,
    facets: ProductFacetsSchema.optional(),
});
export type TProductsList = z.infer<typeof ProductsListSchema>;

export const AdminProductsListSchema = z.object({
    data: GetProductsSchema,
    meta: PaginationMetaSchema,
    facets: ProductFacetsSchema.optional(),
});
export type TAdminProductsList = z.infer<typeof AdminProductsListSchema>;

export const BaseCreateProductSchema = createInsertSchema(productsTable, {
    name: z.string()
        .trim()
        .min(1, "Product name is required"),
    slug: z.string()
        .trim()
        .min(1, "Product slug is required")
        .max(120, "Product slug cannot exceed 120 characters")
        .optional(),
    shortDescription: z.string().trim().max(500, "Short description cannot exceed 500 characters").optional(),
    description: z.string().trim().optional(),
    featuredImageUrl: z.url().trim().min(1, "Featured image URL is required"),
    sellPrice: z.coerce.number<string>().nonnegative("Sell price must be a non-negative number").optional(),
    stock: z.coerce.number<string>().nonnegative("Stock must be a non-negative number").optional(),
    poolStock: z.coerce.number<string>().nonnegative("Pool stock must be a non-negative number").default(0).optional(),
    inventoryType: InventoryTypeSchema.default(InventoryTypeSchema.enum.discrete),
    allowBackorder: z.boolean().default(false).optional(),
    weight: z.coerce.number().positive("Weight must be greater than 0").nullable().optional(),
    packageLength: z.coerce.number().positive("Package length must be greater than 0").nullable().optional(),
    packageWidth: z.coerce.number().positive("Package width must be greater than 0").nullable().optional(),
    packageHeight: z.coerce.number().positive("Package height must be greater than 0").nullable().optional(),
    status: ProductStatusSchema.default(ProductStatusSchema.enum.draft),
    publishedAt: z.coerce.date().optional().nullable(),
}).extend({
    purchasePrice: z.coerce.number<string>().nonnegative("Purchase price must be a non-negative number").optional(),
    categoryIds: z.array(z.string().trim().min(1)).optional(),
    primaryCategoryId: z.string().trim().min(1).optional(),
    options: z.array(CreateProductOptionSchema).optional(),
    variants: z.array(CreateProductVariantSchema).optional(),
}).omit({ deletedAt: true });

export const CreateProductSchema = BaseCreateProductSchema.refine(
    validateDimensionsRefinement,
    { message: "All package dimensions (length, width, height) must be provided together" }
);
export type TCreateProductInput = z.input<typeof CreateProductSchema>;
export type TCreateProductOutput = z.output<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
    data: BaseCreateProductSchema.partial().refine(
        validateDimensionsRefinement,
        { message: "All package dimensions (length, width, height) must be provided together" }
    ),
});
export type TUpdateProductInput = z.input<typeof UpdateProductSchema>;
export type TUpdateProductOutput = z.output<typeof UpdateProductSchema>;

export const ProductPaginationSchema = z.object({
    page: z.coerce.number<string>().int().positive("Page must be a positive integer").default(1),
    pageSize: z.coerce.number<string>().int().positive("Limit must be a positive integer").max(100, "Limit cannot exceed 100").default(10),
    cursor: z.string().trim().min(1, "Cursor cannot be empty").optional(),
});
export type TProductPagination = z.infer<typeof ProductPaginationSchema>;

export const QueryBooleanSchema = z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1");

export const ProductSortSchema = z.object({
    sortBy: z.enum(["createdAt", "publishedAt", "sellPrice", "name", "relevance"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type TProductSort = z.infer<typeof ProductSortSchema>;

export const ProductFilterSchema = z.object({
    search: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    options: z.record(z.string(), z.string()).optional(),
    minPrice: z.coerce.number<string>().nonnegative("Minimum price must be a non-negative number").optional(),
    maxPrice: z.coerce.number<string>().nonnegative("Maximum price must be a non-negative number").optional(),
    inStock: QueryBooleanSchema.optional(),
    includeFacets: QueryBooleanSchema.optional(),
});
export type TProductFilter = z.infer<typeof ProductFilterSchema>;

export const ProductQuerySchema = ProductPaginationSchema
    .merge(ProductSortSchema)
    .merge(ProductFilterSchema);
export type TProductQueryInput = z.input<typeof ProductQuerySchema>;
export type TProductQuery = z.output<typeof ProductQuerySchema>;

export const AdminProductQuerySchema = ProductQuerySchema.extend({
    status: ProductStatusSchema.optional(),
    includeDeleted: QueryBooleanSchema.optional(),
});
export type TAdminProductQueryInput = z.input<typeof AdminProductQuerySchema>;
export type TAdminProductQuery = z.output<typeof AdminProductQuerySchema>;

export const ProductSuggestionItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    category: z.string().optional(),
    sellPrice: z.number(),
    featuredImageUrl: z.string(),
});
export type TProductSuggestionItem = z.infer<typeof ProductSuggestionItemSchema>;

export const CategorySuggestionItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
});
export type TCategorySuggestionItem = z.infer<typeof CategorySuggestionItemSchema>;

export const ProductSuggestionsSchema = z.object({
    products: z.array(ProductSuggestionItemSchema),
    categories: z.array(CategorySuggestionItemSchema),
    tags: z.array(z.string()),
});
export type TProductSuggestions = z.infer<typeof ProductSuggestionsSchema>;

export const SuggestQuerySchema = z.object({
    q: z.string().trim().min(1, "Search query is required").max(100, "Query cannot exceed 100 characters"),
    limit: z.coerce.number<string>().int().positive("Limit must be positive").max(20, "Limit cannot exceed 20").default(8),
});
export type TSuggestQuery = z.infer<typeof SuggestQuerySchema>;

export const RelatedProductsQuerySchema = z.object({
    limit: z.coerce.number<string>().int().positive("Limit must be positive").max(20, "Limit cannot exceed 20").default(8),
});
export type TRelatedProductsQuery = z.infer<typeof RelatedProductsQuerySchema>;

export * from "./logistics";
