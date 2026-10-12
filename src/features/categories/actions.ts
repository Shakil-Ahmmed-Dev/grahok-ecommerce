import { db } from "@/lib/drizzle";
import { categoriesTable } from "@/lib/drizzle/schemas/public";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/error";
import { ensureSlug, slugify } from "@/lib/slug";
import { asc, eq, sql } from "drizzle-orm";
import {
    CategoryDetailSchema,
    type TCategoryBreadcrumb,
    type TCategoryDetail,
    type TCategoryModel,
    type TCategorySlug,
    type TCategoryTreeNode,
    type TCreateCategoryOutput,
    type TUpdateCategoryOutput,
} from "./types";

const getCategoriesTree = async (): Promise<TCategoryTreeNode[]> => {
    const allCategories = await db.query.categoriesTable.findMany({
        orderBy: [asc(categoriesTable.name)],
    });

    const categoryMap = new Map<string, TCategoryTreeNode>();
    for (const cat of allCategories) {
        categoryMap.set(cat.id, {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            parentId: cat.parentId,
            description: cat.description,
            imageUrl: cat.imageUrl,
            createdAt: cat.createdAt,
            updatedAt: cat.updatedAt,
            children: [],
        });
    }

    const rootNodes: TCategoryTreeNode[] = [];
    for (const node of categoryMap.values()) {
        if (node.parentId && categoryMap.has(node.parentId)) {
            categoryMap.get(node.parentId)!.children.push(node);
        } else {
            rootNodes.push(node);
        }
    }

    return rootNodes;
};

const getCategoriesList = async (): Promise<TCategoryModel[]> => {
    return db.query.categoriesTable.findMany({
        orderBy: [asc(categoriesTable.name)],
    });
};

const getCategoryBySlug = async (slug: TCategorySlug): Promise<TCategoryDetail> => {
    const category = await db.query.categoriesTable.findFirst({
        where: (cat, { eq }) => eq(cat.slug, slug),
        with: {
            children: true,
        },
    });

    if (!category) {
        throw new NotFoundError("Category not found");
    }

    const breadcrumbsResult = await db.execute(sql`
        WITH RECURSIVE ancestors AS (
            SELECT id, name, slug, parent_id, 0 AS depth
            FROM ${categoriesTable}
            WHERE id = ${category.id}
            UNION ALL
            SELECT c.id, c.name, c.slug, c.parent_id, a.depth + 1
            FROM ${categoriesTable} c
            JOIN ancestors a ON c.id = a.parent_id
        )
        SELECT id, name, slug
        FROM ancestors
        WHERE id != ${category.id}
        ORDER BY depth DESC;
    `);

    const breadcrumbs = (breadcrumbsResult.rows as unknown as TCategoryBreadcrumb[]).map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
    }));

    return CategoryDetailSchema.parse({
        ...category,
        breadcrumbs,
        children: category.children,
    });
};

const getDescendantCategoryIds = async (categorySlugOrId: string): Promise<string[]> => {
    const result = await db.execute(sql`
        WITH RECURSIVE descendants AS (
            SELECT id
            FROM ${categoriesTable}
            WHERE slug = ${categorySlugOrId} OR id::text = ${categorySlugOrId}
            UNION ALL
            SELECT c.id
            FROM ${categoriesTable} c
            JOIN descendants d ON c.parent_id = d.id
        )
        SELECT id FROM descendants;
    `);

    return (result.rows as Array<{ id: string }>).map((r) => r.id);
};

const createCategory = async (data: TCreateCategoryOutput): Promise<TCategoryModel> => {
    if (data.parentId) {
        const parent = await db.query.categoriesTable.findFirst({
            where: (cat, { eq }) => eq(cat.id, data.parentId!),
            columns: { id: true },
        });
        if (!parent) {
            throw new NotFoundError("Parent category not found");
        }
    }

    const explicitSlug = data.slug;
    const baseSlug = explicitSlug
        ? slugify(explicitSlug)
        : ensureSlug(data.name);

    if (explicitSlug && !baseSlug) {
        throw new BadRequestError("Slug must contain at least one Latin letter or number");
    }

    let slug = baseSlug;
    for (let attempt = 1; attempt <= 10; attempt++) {
        const slugTaken = await db.query.categoriesTable.findFirst({
            where: (cat, { eq }) => eq(cat.slug, slug),
            columns: { id: true },
        });

        if (!slugTaken) {
            break;
        }
        if (explicitSlug) {
            throw new ConflictError("A category with this slug already exists");
        }
        slug = `${baseSlug}-${attempt + 1}`;
        if (attempt === 10) {
            throw new ConflictError("Could not generate a unique slug");
        }
    }

    const [newCategory] = await db.insert(categoriesTable).values({
        ...data,
        slug,
    }).returning();

    return newCategory;
};

const updateCategoryBySlug = async (
    slug: TCategorySlug,
    data: TUpdateCategoryOutput["data"]
): Promise<TCategoryModel> => {
    const existing = await db.query.categoriesTable.findFirst({
        where: (cat, { eq }) => eq(cat.slug, slug),
    });

    if (!existing) {
        throw new NotFoundError("Category not found");
    }

    const updateData = { ...data };

    if (data.parentId !== undefined && data.parentId !== null) {
        if (data.parentId === existing.id) {
            throw new BadRequestError("A category cannot be its own parent");
        }

        const parent = await db.query.categoriesTable.findFirst({
            where: (cat, { eq }) => eq(cat.id, data.parentId!),
            columns: { id: true },
        });
        if (!parent) {
            throw new NotFoundError("Parent category not found");
        }

        const cycleCheck = await db.execute(sql`
            WITH RECURSIVE descendants AS (
                SELECT id FROM ${categoriesTable} WHERE parent_id = ${existing.id}
                UNION ALL
                SELECT c.id FROM ${categoriesTable} c JOIN descendants d ON c.parent_id = d.id
            )
            SELECT id FROM descendants WHERE id = ${data.parentId};
        `);

        if ((cycleCheck.rows ?? []).length > 0) {
            throw new BadRequestError("Cannot set a descendant category as parent (cycle detected)");
        }
    }

    if (data.slug && data.slug !== slug) {
        const newSlug = slugify(data.slug);
        if (!newSlug) {
            throw new BadRequestError("Slug must contain at least one Latin letter or number");
        }

        const slugTaken = await db.query.categoriesTable.findFirst({
            where: (cat, { eq, and, ne }) => and(eq(cat.slug, newSlug), ne(cat.id, existing.id)),
            columns: { id: true },
        });
        if (slugTaken) {
            throw new ConflictError("A category with this slug already exists");
        }
        updateData.slug = newSlug;
    }

    const [updatedCategory] = await db
        .update(categoriesTable)
        .set(updateData)
        .where(eq(categoriesTable.slug, slug))
        .returning();

    return updatedCategory;
};

const deleteCategoryBySlug = async (slug: TCategorySlug): Promise<TCategoryModel> => {
    const [deleted] = await db
        .delete(categoriesTable)
        .where(eq(categoriesTable.slug, slug))
        .returning();

    if (!deleted) {
        throw new NotFoundError("Category not found");
    }

    return deleted;
};

const categoriesActions = {
    getCategoriesTree,
    getCategoriesList,
    getCategoryBySlug,
    getDescendantCategoryIds,
    createCategory,
    updateCategoryBySlug,
    deleteCategoryBySlug,
};

export default categoriesActions;
