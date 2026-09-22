import { AdminProductsListSchema, GetProductPublicSchema, GetProductSchema, ProductsListSchema, type TAdminProductQuery, type TAdminProductsList, type TPaginationMeta, type TProductQuery, type TProductsList, type TCreateProductOutput, type TGetProduct, type TGetProductPublic, type TProductModel, type TProductSlug, type TUpdateProductOutput } from "./types";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/error";
import { db } from "@/lib/drizzle";
import { productsTable } from "@/lib/drizzle/schemas/public";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { buildProductConditions, buildProductOrderBy } from "./query";
import { ensureSlug, slugify } from "@/lib/slug";

const buildPaginationMeta = (total: number, page: number, pageSize: number): TPaginationMeta => {
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    return {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
    };
};

const getProducts = async (query: TProductQuery): Promise<TProductsList> => {
    const conditions = buildProductConditions(query, "public");
    const orderBy = buildProductOrderBy(query.sortBy, query.sortOrder);
    const offset = (query.page - 1) * query.pageSize;

    const [products, total] = await Promise.all([
        db.query.productsTable.findMany({
            where: conditions,
            orderBy,
            offset,
            limit: query.pageSize,
            columns: {
                purchasePrice: false,
                isActive: false,
                createdAt: false,
                updatedAt: false,
                deletedAt: false,
            }
        }),
        db.$count(productsTable, conditions),
    ]);

    const meta = buildPaginationMeta(total, query.page, query.pageSize);
    return ProductsListSchema.parse({ data: products, meta });
};

const getProductBySlug = async (slug: TProductSlug): Promise<TGetProductPublic> => {
    const product = await db.query.productsTable.findFirst({
        where: (product, { eq, and, isNull }) => {
            return and(
                eq(product.slug, slug),
                eq(product.isActive, true),
                isNull(product.deletedAt)
            );
        },
        columns: {
            purchasePrice: false,
            isActive: false,
            createdAt: false,
            updatedAt: false,
            deletedAt: false,
        }
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return GetProductPublicSchema.parse(product);
};

const getAdminProductBySlug = async (slug: TProductSlug): Promise<TGetProduct> => {
    const product = await db.query.productsTable.findFirst({
        where: (product, { eq }) => {
            return eq(product.slug, slug);
        },
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return GetProductSchema.parse(product);
};

const getAdminProducts = async (query: TAdminProductQuery): Promise<TAdminProductsList> => {
    const conditions = buildProductConditions(query, "admin");
    const orderBy = buildProductOrderBy(query.sortBy, query.sortOrder);
    const offset = (query.page - 1) * query.pageSize;

    const [products, total] = await Promise.all([
        db.query.productsTable.findMany({
            where: conditions,
            orderBy,
            offset,
            limit: query.pageSize,
        }),
        db.$count(productsTable, conditions),
    ]);

    const meta = buildPaginationMeta(total, query.page, query.pageSize);
    return AdminProductsListSchema.parse({ data: products, meta });
};

const createProduct = async (data: TCreateProductOutput): Promise<TProductModel> => {
    const explicitSlug = data.slug;
    const baseSlug = explicitSlug
        ? slugify(explicitSlug)
        : ensureSlug(data.name);

    if (explicitSlug && !baseSlug) {
        throw new BadRequestError("Slug must contain at least one Latin letter or number");
    }

    let slug = baseSlug;
    for (let attempt = 1; attempt <= 10; attempt++) {
        const slugTaken = await db.query.productsTable.findFirst({
            where: (product, { eq }) => {
                return eq(product.slug, slug);
            },
            columns: {
                id: true,
            },
        });

        if (!slugTaken) {
            break;
        }
        if (explicitSlug) {
            throw new ConflictError("A product with this slug already exists");
        }
        slug = `${baseSlug}-${attempt + 1}`;
        if (attempt === 10) {
            throw new ConflictError("Could not generate a unique slug");
        }
    }

    const [product] = await db.insert(productsTable).values({ ...data, slug }).returning();
    return product;
};

const updateProductBySlug = async (slug: TProductSlug, data: TUpdateProductOutput["data"]): Promise<TProductModel> => {
    const existingProduct = await db.query.productsTable.findFirst({
        where: (product, { eq, and, isNull }) => {
            return and(eq(product.slug, slug), isNull(product.deletedAt));
        },
    });
    if (existingProduct) {
        let updateData = data;

        if (data.slug && data.slug !== slug) {
            const newSlug = slugify(data.slug);
            if (!newSlug) {
                throw new BadRequestError("Slug must contain at least one Latin letter or number");
            }

            const slugTaken = await db.query.productsTable.findFirst({
                where: (product, { eq, and, ne }) => {
                    return and(eq(product.slug, newSlug), ne(product.id, existingProduct.id));
                },
            });
            if (slugTaken) {
                throw new ConflictError("A product with this slug already exists");
            }

            updateData = { ...data, slug: newSlug };
        }

        const [product] = await db.update(productsTable)
            .set(updateData)
            .where(and(eq(productsTable.slug, slug), isNull(productsTable.deletedAt)))
            .returning();

        return product;
    }
    throw new NotFoundError("Product not found");
};

const deleteProductBySlug = async (slug: TProductSlug): Promise<TProductModel> => {
    const [product] = await db.update(productsTable)
        .set({ deletedAt: new Date() })
        .where(and(eq(productsTable.slug, slug), isNull(productsTable.deletedAt)))
        .returning();

    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return product;
};

const restoreProductBySlug = async (slug: TProductSlug): Promise<TProductModel> => {
    const [product] = await db.update(productsTable)
        .set({ deletedAt: null })
        .where(and(eq(productsTable.slug, slug), isNotNull(productsTable.deletedAt)))
        .returning();

    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return product;
};

const productsActions = {
    getProducts,
    getProductBySlug,
    getAdminProducts,
    getAdminProductBySlug,
    createProduct,
    updateProductBySlug,
    deleteProductBySlug,
    restoreProductBySlug,
};

export default productsActions;