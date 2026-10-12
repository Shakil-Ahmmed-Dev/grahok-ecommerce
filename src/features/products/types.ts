import { productsTable, productVariantsTable } from "@/lib/drizzle/schemas/public";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";
import { INVENTORY_TYPES, PRODUCT_STATUSES, WEIGHT_UNITS } from "./constants";

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

export const WeightUnitSchema = z.enum(WEIGHT_UNITS);
export type TWeightUnit = z.infer<typeof WeightUnitSchema>;

export const ProductVariantModelSchema = createSelectSchema(productVariantsTable);
export type TProductVariantModel = z.infer<typeof ProductVariantModelSchema>;

export const ProductVariantPublicSchema = z.object({
    id: z.string(),
    productId: z.string(),
    title: z.string(),
    weightValue: z.number(),
    weightUnit: WeightUnitSchema,
    sku: z.string(),
    sellPrice: z.number(),
    stock: z.number(),
    poolConsumptionRate: z.number().nullable().optional(),
    isDefault: z.boolean(),
    isActive: z.boolean(),
    imageUrl: z.string().nullable().optional(),
});
export type TProductVariantPublic = z.infer<typeof ProductVariantPublicSchema>;

export const ProductVariantSchema = ProductVariantPublicSchema.extend({
    purchasePrice: z.number(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
});
export type TProductVariant = z.infer<typeof ProductVariantSchema>;

export const CreateProductVariantSchema = z.object({
    title: z.string().trim().min(1).optional(),
    weightValue: z.coerce.number().positive("Weight must be greater than 0"),
    weightUnit: WeightUnitSchema,
    sku: z.string().trim().min(1, "SKU cannot be empty").optional(),
    purchasePrice: z.coerce.number().nonnegative("Purchase price must be a non-negative number"),
    sellPrice: z.coerce.number().nonnegative("Sell price must be a non-negative number"),
    stock: z.coerce.number().nonnegative("Stock must be a non-negative number").default(0),
    poolConsumptionRate: z.coerce.number().positive("Pool consumption rate must be greater than 0").nullable().optional(),
    isDefault: z.boolean().default(false),
    isActive: z.boolean().default(true),
    imageUrl: z.url("Image URL must be a valid URL").trim().nullable().optional(),
});
export type TCreateProductVariantInput = z.input<typeof CreateProductVariantSchema>;
export type TCreateProductVariantOutput = z.output<typeof CreateProductVariantSchema>;

export const UpdateProductVariantSchema = CreateProductVariantSchema.partial();
export type TUpdateProductVariantInput = z.input<typeof UpdateProductVariantSchema>;
export type TUpdateProductVariantOutput = z.output<typeof UpdateProductVariantSchema>;

export const VariantIdSchema = z.string().uuid("Invalid variant ID format");
export type TVariantId = z.infer<typeof VariantIdSchema>;

export const ProductCategoryItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    isPrimary: z.boolean(),
});
export type TProductCategoryItem = z.infer<typeof ProductCategoryItemSchema>;

export const ProductModelSchema = createSelectSchema(productsTable, {
    inventoryType: InventoryTypeSchema.default(InventoryTypeSchema.enum.discrete),
    baseWeightUnit: WeightUnitSchema.nullable().optional(),
});
export type TProductModel = z.infer<typeof ProductModelSchema>;

export const GetProductBaseSchema = ProductModelSchema.omit({
    searchVector: true,
});

export const GetProductSchema = GetProductBaseSchema.extend({
    categories: z.array(ProductCategoryItemSchema).default([]),
    variants: z.array(ProductVariantSchema).default([]),
});
export type TGetProduct = z.infer<typeof GetProductSchema>;

export const GetProductsSchema = GetProductSchema.array();
export type TGetProducts = z.infer<typeof GetProductsSchema>;

export const GetProductPublicBaseSchema = ProductModelSchema.omit({
    purchasePrice: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
    searchVector: true,
});

export const GetProductPublicSchema = GetProductPublicBaseSchema.extend({
    categories: z.array(ProductCategoryItemSchema).default([]),
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

export const ProductFacetsSchema = z.object({
    categories: z.array(CategoryFacetSchema),
    tags: z.array(TagFacetSchema),
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

export const CreateProductSchema = createInsertSchema(productsTable, {
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
    purchasePrice: z.coerce.number<string>().nonnegative("Purchase price must be a non-negative number"),
    sellPrice: z.coerce.number<string>().nonnegative("Sell price must be a non-negative number"),
    stock: z.coerce.number<string>().nonnegative("Stock must be a non-negative number").optional(),
    inventoryType: InventoryTypeSchema.default(InventoryTypeSchema.enum.discrete),
    baseWeightUnit: WeightUnitSchema.optional().nullable(),
    status: ProductStatusSchema.default(ProductStatusSchema.enum.draft),
    publishedAt: z.coerce.date().optional().nullable(),
}).extend({
    categoryIds: z.array(z.string().trim().min(1)).optional(),
    primaryCategoryId: z.string().trim().min(1).optional(),
    variants: z.array(CreateProductVariantSchema).optional(),
}).omit({ deletedAt: true });
export type TCreateProductInput = z.input<typeof CreateProductSchema>;
export type TCreateProductOutput = z.output<typeof CreateProductSchema>;

export const UpdateProductSchema = z.object({
    data: CreateProductSchema.partial(),
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

