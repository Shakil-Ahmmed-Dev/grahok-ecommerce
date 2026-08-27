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
});
export type TGetProductPublic = z.infer<typeof GetProductPublicSchema>;

export const GetProductsPublicSchema = GetProductPublicSchema.array();
export type TGetProductsPublic = z.infer<typeof GetProductsPublicSchema>;

export const CreateProductSchema = createInsertSchema(productsTable, {
    name: z.string()
        .trim()
        .min(1, "Product name is required"),
    slug: z.string()
        .trim()
        .min(1, "Product slug is required")
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be URL-friendly"), // TODO: Can't put spaces, capital letters or bangla characters, need to find a way to convert them to URL-friendly format
    featuredImageUrl: z.url().trim().min(1, "Featured image URL is required"),
    purchasePrice: z.coerce.number<string>().nonnegative("Purchase price must be a non-negative number"),
    sellPrice: z.coerce.number<string>().nonnegative("Sell price must be a non-negative number"),
    stock: z.coerce.number<string>().nonnegative("Stock must be a non-negative number").optional(),
});
export type TCreateProductInput = z.input<typeof CreateProductSchema>;
export type TCreateProductOutput = z.output<typeof CreateProductSchema>;


export const UpdateProductSchema = z.object({
    id: ProductModelSchema.shape.id,
    data: CreateProductSchema.partial()
});
export type TUpdateProductInput = z.input<typeof UpdateProductSchema>;
export type TUpdateProductOutput = z.output<typeof UpdateProductSchema>;

export const ProductPaginationSchema = z.object({
    page: z.coerce.number<string>().int().positive("Page must be a positive integer").default(1),
    pageSize: z.coerce.number<string>().int().positive("Limit must be a positive integer").max(100, "Limit cannot exceed 100").default(10),
});
export type TProductPagination = z.infer<typeof ProductPaginationSchema>;
