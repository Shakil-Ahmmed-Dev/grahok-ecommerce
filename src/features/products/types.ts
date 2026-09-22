import { productsTable } from "@/lib/drizzle/schemas/public";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import z from "zod";

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

export const ProductModelSchema = createSelectSchema(productsTable);
export type TProductModel = z.infer<typeof ProductModelSchema>;

export const GetProductSchema = ProductModelSchema;
export type TGetProduct = z.infer<typeof GetProductSchema>;

export const GetProductsSchema = ProductModelSchema.array();
export type TGetProducts = z.infer<typeof GetProductsSchema>;

export const GetProductPublicSchema = ProductModelSchema.omit({
    purchasePrice: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
});
export type TGetProductPublic = z.infer<typeof GetProductPublicSchema>;

export const GetProductsPublicSchema = GetProductPublicSchema.array();
export type TGetProductsPublic = z.infer<typeof GetProductsPublicSchema>;

export const PaginationMetaSchema = z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
});
export type TPaginationMeta = z.infer<typeof PaginationMetaSchema>;

export const ProductsListSchema = z.object({
    data: GetProductsPublicSchema,
    meta: PaginationMetaSchema,
});
export type TProductsList = z.infer<typeof ProductsListSchema>;

export const AdminProductsListSchema = z.object({
    data: GetProductsSchema,
    meta: PaginationMetaSchema,
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
    featuredImageUrl: z.url().trim().min(1, "Featured image URL is required"),
    purchasePrice: z.coerce.number<string>().nonnegative("Purchase price must be a non-negative number"),
    sellPrice: z.coerce.number<string>().nonnegative("Sell price must be a non-negative number"),
    stock: z.coerce.number<string>().nonnegative("Stock must be a non-negative number").optional(),
}).omit({ deletedAt: true });
export type TCreateProductInput = z.input<typeof CreateProductSchema>;
export type TCreateProductOutput = z.output<typeof CreateProductSchema>;


export const UpdateProductSchema = z.object({
    data: CreateProductSchema.partial()
});
export type TUpdateProductInput = z.input<typeof UpdateProductSchema>;
export type TUpdateProductOutput = z.output<typeof UpdateProductSchema>;

export const ProductPaginationSchema = z.object({
    page: z.coerce.number<string>().int().positive("Page must be a positive integer").default(1),
    pageSize: z.coerce.number<string>().int().positive("Limit must be a positive integer").max(100, "Limit cannot exceed 100").default(10),
});
export type TProductPagination = z.infer<typeof ProductPaginationSchema>;

export const QueryBooleanSchema = z
    .enum(["true", "false", "1", "0"])
    .transform((value) => value === "true" || value === "1");

export const ProductSortSchema = z.object({
    sortBy: z.enum(["createdAt", "sellPrice", "name"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type TProductSort = z.infer<typeof ProductSortSchema>;

export const ProductFilterSchema = z.object({
    search: z.string().trim().min(1).max(100).optional(),
    category: z.string().trim().min(1).max(100).optional(),
    subcategory: z.string().trim().min(1).max(100).optional(),
    tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
    minPrice: z.coerce.number<string>().nonnegative("Minimum price must be a non-negative number").optional(),
    maxPrice: z.coerce.number<string>().nonnegative("Maximum price must be a non-negative number").optional(),
    inStock: QueryBooleanSchema.optional(),
});
export type TProductFilter = z.infer<typeof ProductFilterSchema>;

export const ProductQuerySchema = ProductPaginationSchema
    .merge(ProductSortSchema)
    .merge(ProductFilterSchema);
export type TProductQueryInput = z.input<typeof ProductQuerySchema>;
export type TProductQuery = z.output<typeof ProductQuerySchema>;

export const AdminProductQuerySchema = ProductQuerySchema.extend({
    isActive: QueryBooleanSchema.optional(),
    includeDeleted: QueryBooleanSchema.optional(),
});
export type TAdminProductQueryInput = z.input<typeof AdminProductQuerySchema>;
export type TAdminProductQuery = z.output<typeof AdminProductQuerySchema>;
