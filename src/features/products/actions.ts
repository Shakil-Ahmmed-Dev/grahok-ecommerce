import {
    AdminProductsListSchema,
    GetProductPublicSchema,
    GetProductSchema,
    ProductsListSchema,
    ProductSuggestionsSchema,
    type TAdminProductQuery,
    type TAdminProductsList,
    type TPaginationMeta,
    type TProductQuery,
    type TProductsList,
    type TCreateProductOutput,
    type TGetProduct,
    type TGetProductPublic,
    type TProductModel,
    type TProductSlug,
    type TUpdateProductOutput,
    type TSuggestQuery,
    type TProductSuggestions,
} from "./types";
import { BadRequestError, ConflictError, NotFoundError } from "@/lib/error";
import { db } from "@/lib/drizzle";
import { productsTable } from "@/lib/drizzle/schemas/public";
import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import {
    buildCursorCondition,
    buildProductConditions,
    buildProductOrderBy,
    buildProductSearchQuery,
    decodeCursor,
    encodeCursor,
    getProductFacets,
    resolveProductSort,
} from "./query";
import { ensureSlug, slugify } from "@/lib/slug";

const buildPaginationMeta = (
    total: number | undefined,
    page: number | undefined,
    pageSize: number,
    hasNextPage: boolean,
    hasPrevPage: boolean,
    nextCursor?: string | null,
    prevCursor?: string | null
): TPaginationMeta => {
    const totalPages = total !== undefined ? (total === 0 ? 0 : Math.ceil(total / pageSize)) : undefined;
    return {
        ...(page !== undefined ? { page } : {}),
        pageSize,
        ...(total !== undefined ? { total, totalPages } : {}),
        hasNextPage,
        hasPrevPage,
        ...(nextCursor !== undefined ? { nextCursor } : {}),
        ...(prevCursor !== undefined ? { prevCursor } : {}),
    };
};

const getProducts = async (query: TProductQuery): Promise<TProductsList> => {
    const searchQuery = buildProductSearchQuery(query.search);
    const effectiveSort = resolveProductSort(query);
    const orderBy = buildProductOrderBy(effectiveSort, query.sortOrder, searchQuery);

    let cursorCondition: SQL | null = null;
    let decodedCursor: { createdAt: Date; id: string } | null = null;
    if (query.cursor) {
        decodedCursor = decodeCursor(query.cursor);
        if (!decodedCursor) {
            throw new BadRequestError("Invalid cursor provided");
        }
        cursorCondition = buildCursorCondition(decodedCursor, query.sortOrder);
    }

    const baseConditions = buildProductConditions(query, "public", searchQuery);
    const queryConditions = buildProductConditions(query, "public", searchQuery, cursorCondition);

    const isCursorMode = Boolean(query.cursor);
    const limit = query.pageSize + 1;
    const offset = isCursorMode ? undefined : (query.page - 1) * query.pageSize;
    const shouldComputeFacets = query.includeFacets ?? (query.page === 1 && !isCursorMode && query.pageSize >= 10);

    const [rawProducts, total, facets] = await Promise.all([
        db.query.productsTable.findMany({
            where: queryConditions,
            orderBy,
            offset,
            limit,
            columns: {
                purchasePrice: false,
                isActive: false,
                updatedAt: false,
                deletedAt: false,
                searchVector: false,
            },
        }),
        isCursorMode ? Promise.resolve(undefined) : db.$count(productsTable, baseConditions),
        shouldComputeFacets ? getProductFacets(baseConditions) : Promise.resolve(undefined),
    ]);

    const hasNextPage = rawProducts.length > query.pageSize;
    const products = hasNextPage ? rawProducts.slice(0, query.pageSize) : rawProducts;
    const hasPrevPage = isCursorMode ? true : query.page > 1;

    const lastProduct = products[products.length - 1];
    const nextCursor = hasNextPage && lastProduct
        ? encodeCursor(new Date(lastProduct.createdAt), lastProduct.id)
        : null;

    const meta = buildPaginationMeta(
        total,
        isCursorMode ? undefined : query.page,
        query.pageSize,
        hasNextPage,
        hasPrevPage,
        nextCursor
    );

    return ProductsListSchema.parse({
        data: products,
        meta,
        ...(facets ? { facets } : {}),
    });
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
            searchVector: false,
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
        columns: {
            searchVector: false,
        }
    });
    if (!product) {
        throw new NotFoundError("Product not found");
    }
    return GetProductSchema.parse(product);
};

const getAdminProducts = async (query: TAdminProductQuery): Promise<TAdminProductsList> => {
    const searchQuery = buildProductSearchQuery(query.search);
    const effectiveSort = resolveProductSort(query);
    const orderBy = buildProductOrderBy(effectiveSort, query.sortOrder, searchQuery);

    let cursorCondition: SQL | null = null;
    let decodedCursor: { createdAt: Date; id: string } | null = null;
    if (query.cursor) {
        decodedCursor = decodeCursor(query.cursor);
        if (!decodedCursor) {
            throw new BadRequestError("Invalid cursor provided");
        }
        cursorCondition = buildCursorCondition(decodedCursor, query.sortOrder);
    }

    const baseConditions = buildProductConditions(query, "admin", searchQuery);
    const queryConditions = buildProductConditions(query, "admin", searchQuery, cursorCondition);

    const isCursorMode = Boolean(query.cursor);
    const limit = query.pageSize + 1;
    const offset = isCursorMode ? undefined : (query.page - 1) * query.pageSize;
    const shouldComputeFacets = query.includeFacets ?? (query.page === 1 && !isCursorMode && query.pageSize >= 10);

    const [rawProducts, total, facets] = await Promise.all([
        db.query.productsTable.findMany({
            where: queryConditions,
            orderBy,
            offset,
            limit,
            columns: {
                searchVector: false,
            },
        }),
        isCursorMode ? Promise.resolve(undefined) : db.$count(productsTable, baseConditions),
        shouldComputeFacets ? getProductFacets(baseConditions) : Promise.resolve(undefined),
    ]);

    const hasNextPage = rawProducts.length > query.pageSize;
    const products = hasNextPage ? rawProducts.slice(0, query.pageSize) : rawProducts;
    const hasPrevPage = isCursorMode ? true : query.page > 1;

    const lastProduct = products[products.length - 1];
    const nextCursor = hasNextPage && lastProduct
        ? encodeCursor(new Date(lastProduct.createdAt), lastProduct.id)
        : null;

    const meta = buildPaginationMeta(
        total,
        isCursorMode ? undefined : query.page,
        query.pageSize,
        hasNextPage,
        hasPrevPage,
        nextCursor
    );

    return AdminProductsListSchema.parse({
        data: products,
        meta,
        ...(facets ? { facets } : {}),
    });
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

const suggestProducts = async (query: TSuggestQuery): Promise<TProductSuggestions> => {
    const trimmed = query.q.trim();
    if (!trimmed) {
        return {
            products: [],
            categories: [],
            tags: [],
        };
    }

    const searchQuery = buildProductSearchQuery(trimmed);

    const productConditions = [
        eq(productsTable.isActive, true),
        isNull(productsTable.deletedAt),
    ];
    if (searchQuery) {
        productConditions.push(sql`${productsTable.searchVector} @@ ${searchQuery}`);
    } else {
        productConditions.push(sql`${productsTable.name} ILIKE ${`%${trimmed}%`}`);
    }

    const [matchedProducts, matchedCategories, matchedTags] = await Promise.all([
        db.query.productsTable.findMany({
            where: and(...productConditions),
            orderBy: searchQuery
                ? [desc(sql`ts_rank(${productsTable.searchVector}, ${searchQuery})`)]
                : [desc(productsTable.createdAt)],
            limit: Math.min(query.limit, 5),
            columns: {
                id: true,
                name: true,
                slug: true,
                category: true,
                sellPrice: true,
                featuredImageUrl: true,
            },
        }),
        db.execute(sql`
            SELECT DISTINCT ${productsTable.category} AS name
            FROM ${productsTable}
            WHERE ${productsTable.isActive} = true
              AND ${productsTable.deletedAt} IS NULL
              AND ${productsTable.category} ILIKE ${`%${trimmed}%`}
            LIMIT 3
        `),
        db.execute(sql`
            SELECT DISTINCT tag
            FROM ${productsTable}, jsonb_array_elements_text(coalesce(${productsTable.tags}, '[]'::jsonb)) AS tag
            WHERE ${productsTable.isActive} = true
              AND ${productsTable.deletedAt} IS NULL
              AND tag ILIKE ${`%${trimmed}%`}
            LIMIT 3
        `),
    ]);

    const categories = (matchedCategories.rows as Array<{ name: string }>).map((r) => r.name);
    const tags = (matchedTags.rows as Array<{ tag: string }>).map((r) => r.tag);

    return ProductSuggestionsSchema.parse({
        products: matchedProducts.map((p) => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            category: p.category,
            sellPrice: Number(p.sellPrice),
            featuredImageUrl: p.featuredImageUrl,
        })),
        categories,
        tags,
    });
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
    suggestProducts,
    getProductFacets,
};

export default productsActions;