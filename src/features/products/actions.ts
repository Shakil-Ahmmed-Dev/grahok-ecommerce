import { AdminProductsListSchema, GetProductPublicSchema, GetProductSchema, ProductsListSchema, type TAdminProductQuery, type TAdminProductsList, type TPaginationMeta, type TProductQuery, type TProductsList, type TCreateProductOutput, type TGetProduct, type TGetProductPublic, type TProductModel, type TProductSlug, type TUpdateProductOutput } from "./types";
import { ConflictError, NotFoundError } from "@/lib/error";
import { db } from "@/lib/drizzle";
import { productsTable } from "@/lib/drizzle/schemas/public";
import { eq } from "drizzle-orm";
import { buildProductConditions, buildProductOrderBy } from "./query";

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
            }
        }),
        db.$count(productsTable, conditions),
    ]);

    const meta = buildPaginationMeta(total, query.page, query.pageSize);
    return ProductsListSchema.parse({ data: products, meta });
};

const getProductBySlug = async (slug: TProductSlug): Promise<TGetProductPublic> => {
    const product = await db.query.productsTable.findFirst({
        where: (product, { eq, and }) => {
            return and(eq(product.slug, slug), eq(product.isActive, true));
        },
        columns: {
            purchasePrice: false,
            isActive: false,
            createdAt: false,
            updatedAt: false,
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
    const existingProduct = await db.query.productsTable.findFirst({
        where: (product, { eq }) => {
            return eq(product.slug, data.slug);
        },
    });
    if (existingProduct) {
        throw new ConflictError("A product with this slug already exists");
    }

    const [product] = await db.insert(productsTable).values(data).returning();
    return product;
};

const updateProductBySlug = async (slug: TProductSlug, data: TUpdateProductOutput["data"]): Promise<TProductModel> => {
    const existingProduct = await db.query.productsTable.findFirst({
        where: (product, { eq }) => {
            return eq(product.slug, slug);
        },
    });
    if (existingProduct) {
        if (data.slug && data.slug !== slug) {
            const newSlug = data.slug;
            const slugTaken = await db.query.productsTable.findFirst({
                where: (product, { eq, and, ne }) => {
                    return and(eq(product.slug, newSlug), ne(product.id, existingProduct.id));
                },
            });
            if (slugTaken) {
                throw new ConflictError("A product with this slug already exists");
            }
        }

        const [product] = await db.update(productsTable)
            .set(data)
            .where(eq(productsTable.slug, slug))
            .returning();

        return product;
    }
    throw new NotFoundError("Product not found");
};

const deleteProductBySlug = async (slug: TProductSlug): Promise<TProductModel> => {
    const [product] = await db.delete(productsTable)
        .where(eq(productsTable.slug, slug))
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
};

export default productsActions;