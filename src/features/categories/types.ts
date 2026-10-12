import { categoriesTable } from "@/lib/drizzle/schemas/public";
import { createSelectSchema } from "drizzle-zod";
import z from "zod";

export const CategorySlugSchema = z.string().trim().min(1, "Category slug is required");
export type TCategorySlug = z.infer<typeof CategorySlugSchema>;

export const CategoryModelSchema = createSelectSchema(categoriesTable);
export type TCategoryModel = z.infer<typeof CategoryModelSchema>;

export const CreateCategorySchema = z.object({
    name: z.string().trim().min(1, "Category name is required").max(100, "Category name cannot exceed 100 characters"),
    slug: z.string().trim().min(1).max(120, "Category slug cannot exceed 120 characters").optional(),
    parentId: z.string().uuid("Parent category ID must be a valid UUID").nullable().optional(),
    description: z.string().trim().max(1000, "Description cannot exceed 1000 characters").default("").optional(),
    imageUrl: z.url("Image URL must be a valid URL").trim().nullable().optional(),
});
export type TCreateCategoryInput = z.input<typeof CreateCategorySchema>;
export type TCreateCategoryOutput = z.output<typeof CreateCategorySchema>;

export const UpdateCategorySchema = z.object({
    data: CreateCategorySchema.partial(),
});
export type TUpdateCategoryInput = z.input<typeof UpdateCategorySchema>;
export type TUpdateCategoryOutput = z.output<typeof UpdateCategorySchema>;

export const CategoryBreadcrumbSchema = z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
});
export type TCategoryBreadcrumb = z.infer<typeof CategoryBreadcrumbSchema>;

export type TCategoryTreeNode = {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    description: string;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    children: TCategoryTreeNode[];
};

export const CategoryTreeNodeSchema: z.ZodType<TCategoryTreeNode> = z.lazy(() =>
    z.object({
        id: z.string(),
        name: z.string(),
        slug: z.string(),
        parentId: z.string().nullable(),
        description: z.string(),
        imageUrl: z.string().nullable(),
        createdAt: z.date(),
        updatedAt: z.date(),
        children: z.array(CategoryTreeNodeSchema),
    })
);

export const CategoryDetailSchema = CategoryModelSchema.extend({
    breadcrumbs: z.array(CategoryBreadcrumbSchema),
    children: z.array(CategoryModelSchema).optional(),
});
export type TCategoryDetail = z.infer<typeof CategoryDetailSchema>;
