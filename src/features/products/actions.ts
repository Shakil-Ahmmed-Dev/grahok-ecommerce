import { AdminProductsListSchema, ProductsListSchema, type TAdminProductQuery, type TAdminProductsList, type TPaginationMeta, type TProductQuery, type TProductsList, type TCreateProductOutput, type TProductModel, type TUpdateProductOutput } from "./types";
import { NotFoundError } from "@/lib/error";
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
    const [product] = await db.insert(productsTable).values(data).returning();
    return product;
};

const updateProduct = async (id: TUpdateProductOutput["id"], data: TUpdateProductOutput["data"]): Promise<TProductModel> => {
    const existingProduct = await db.query.productsTable.findFirst({
        where: (product, { eq }) => {
            return eq(product.id, id);
        },
    });
    if (existingProduct) {
        const [product] = await db.update(productsTable)
            .set(data)
            .where(eq(productsTable.id, id))
            .returning();

        return product;
    }
    throw new NotFoundError("Product not found");
};

const productsActions = {
    getProducts,
    getAdminProducts,
    createProduct,
    updateProduct,
};

export default productsActions;