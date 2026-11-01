import { db } from "@/lib/drizzle";
import {
    customerAddressesTable,
    customersTable,
    orderItemsTable,
    ordersTable,
    orderStatusesTable,
    type TCheckoutAddressSnapshot,
    type TConsignmentLogisticsSnapshot,
} from "@/lib/drizzle/schemas/public";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@/lib/error";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "crypto";
import customerActions from "@/features/customers/actions";
import { recordCustomerAuditLog } from "@/features/customers/audit";
import { assertCustomerSelfServiceAccess } from "@/features/customers/self-service-policy";
import {
    getVariantCheckoutSnapshots,
    releaseVariantInventory,
    reserveVariantInventory,
} from "@/features/products/actions";
import { roundToDecimals } from "@/features/products/logistics";
import type { TVariantCheckoutSnapshot } from "@/features/products/types";
import {
    CANCELLABLE_ORDER_STATUSES,
    type TOrderStatus,
} from "./constants";
import { calculateCheckoutPricing, type CheckoutPricingItemInput } from "./pricing";
import {
    AdminOrderListQuerySchema,
    AdminOrderStatusTransitionInputSchema,
    CheckoutAddressSchema,
    CheckoutEstimateInputSchema,
    CheckoutEstimateResponseSchema,
    CheckoutProcessInputSchema,
    CustomerOrderListQuerySchema,
    OrderDTOSchema,
    type AdminOrderListResponse,
    type CustomerOrderListResponse,
    type TAdminOrderListQuery,
    type TAdminOrderStatusTransitionInput,
    type TCheckoutAddress,
    type TCheckoutEstimateInput,
    type TCheckoutEstimateResponse,
    type TCheckoutProcessInput,
    type TCustomerOrderListQuery,
    type TOrderDTO,
} from "./types";

/**
 * Generate a customer-friendly unique order number.
 * Example: ORD-20261023-A1B2C3D4
 */
export function generateOrderNumber(): string {
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomHex = randomUUID().replace(/-/g, "").substring(0, 8).toUpperCase();
    return `ORD-${datePrefix}-${randomHex}`;
}

/**
 * Generate a cryptographically secure random token and its SHA-256 hash for guest checkout access.
 */
export function generateGuestAccessToken(): { token: string; hash: string } {
    const token = randomBytes(32).toString("hex");
    const hash = hashGuestAccessToken(token);
    return { token, hash };
}

/**
 * Hash a guest access token using SHA-256.
 */
export function hashGuestAccessToken(token: string): string {
    return createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Constant-time comparison between provided plain token and stored SHA-256 hash.
 */
export function verifyGuestAccessToken(providedToken: string, storedHash: string): boolean {
    if (!providedToken || !storedHash) return false;
    const computedHash = hashGuestAccessToken(providedToken);
    if (computedHash.length !== storedHash.length) return false;
    return timingSafeEqual(Buffer.from(computedHash, "utf-8"), Buffer.from(storedHash, "utf-8"));
}

export interface CheckoutContext {
    authUserId?: string;
    userEmail?: string;
    userName?: string;
    emailVerified?: boolean;
    clientIp?: string;
    userAgent?: string;
    headers?: Headers;
}

/**
 * Estimates checkout pricing, verifies stock & purchasability, and returns consignment logistics.
 * Non-mutating pre-checkout calculation.
 */
export async function estimateCheckout(
    input: TCheckoutEstimateInput
): Promise<TCheckoutEstimateResponse> {
    const validated = CheckoutEstimateInputSchema.parse(input);

    // 1. Consolidate line item quantities by variantId
    const itemQuantityMap = new Map<string, number>();
    for (const item of validated.items) {
        const current = itemQuantityMap.get(item.variantId) ?? 0;
        itemQuantityMap.set(item.variantId, current + item.quantity);
    }

    const variantIds = Array.from(itemQuantityMap.keys());
    const snapshots = await getVariantCheckoutSnapshots(variantIds);
    const snapshotMap = new Map<string, TVariantCheckoutSnapshot>(
        snapshots.map((s) => [s.variantId, s])
    );

    const warnings: string[] = [];
    let isReadyForCheckout = true;
    const enrichedItems: Array<{
        snapshot: TVariantCheckoutSnapshot;
        quantity: number;
        lineTotal: number;
        isPurchasable: boolean;
        availabilityStatus: "in_stock" | "backorder" | "out_of_stock" | "inactive" | "product_unavailable";
    }> = [];
    const pricingInputs: CheckoutPricingItemInput[] = [];

    for (const [variantId, quantity] of itemQuantityMap.entries()) {
        const snap = snapshotMap.get(variantId);

        if (!snap) {
            isReadyForCheckout = false;
            warnings.push(`Variant '${variantId}' could not be found`);
            continue;
        }

        let availabilityStatus: "in_stock" | "backorder" | "out_of_stock" | "inactive" | "product_unavailable" = "in_stock";
        let isPurchasable = snap.isPurchasable;

        if (!snap.isActive) {
            availabilityStatus = "inactive";
            isPurchasable = false;
            warnings.push(`'${snap.title} (${snap.variantTitle})' is currently unavailable`);
        } else if (snap.isUnlimited) {
            availabilityStatus = "in_stock";
        } else if (snap.availableStock != null && snap.availableStock >= quantity) {
            availabilityStatus = "in_stock";
        } else if (snap.allowBackorder) {
            availabilityStatus = "backorder";
        } else {
            availabilityStatus = "out_of_stock";
            isPurchasable = false;
            warnings.push(
                `Insufficient stock for '${snap.title} (${snap.variantTitle})'. Requested: ${quantity}, Available: ${snap.availableStock ?? 0}`
            );
        }

        if (!isPurchasable) {
            isReadyForCheckout = false;
        }

        const lineTotal = roundToDecimals(snap.currentPrice * quantity, 2);

        enrichedItems.push({
            snapshot: snap,
            quantity,
            lineTotal,
            isPurchasable,
            availabilityStatus,
        });

        pricingInputs.push({
            snapshot: snap,
            quantity,
        });
    }

    const pricing = calculateCheckoutPricing(pricingInputs);

    return CheckoutEstimateResponseSchema.parse({
        items: enrichedItems,
        subtotal: pricing.subtotal,
        shippingFee: pricing.shippingFee,
        tax: pricing.tax,
        discount: pricing.discount,
        totalAmount: pricing.totalAmount,
        currency: pricing.currency,
        logistics: pricing.logistics,
        isReadyForCheckout,
        warnings,
    });
}

/**
 * Executes full checkout processing:
 * 1. Resolves registered vs guest customer
 * 2. Resolves shipping and billing addresses
 * 3. Resolves and validates variant snapshots & inventory availability
 * 4. Atomically reserves stock (with rollback if any item fails)
 * 5. Creates immutable order & order items
 * 6. Updates customer statistics and records audit log
 */
export async function processCheckout(
    input: TCheckoutProcessInput,
    context?: CheckoutContext
): Promise<TOrderDTO> {
    const validated = CheckoutProcessInputSchema.parse(input);

    // 1. Consolidate quantities
    const itemQuantityMap = new Map<string, number>();
    for (const item of validated.items) {
        const current = itemQuantityMap.get(item.variantId) ?? 0;
        itemQuantityMap.set(item.variantId, current + item.quantity);
    }
    const variantIds = Array.from(itemQuantityMap.keys());

    // 2. Resolve Customer (Authenticated vs Guest)
    let customerId: string;
    let customerType: "registered" | "guest";
    let customerEmail: string;
    let customerName: string | null = null;
    let customerPhone: string | null = null;

    if (context?.authUserId) {
        // Authenticated customer
        const authUserEmail = context.userEmail ?? validated.customer?.email;
        if (!authUserEmail) {
            throw new BadRequestError("User email is required for authenticated checkout");
        }

        const customer = await customerActions.getOrCreateCustomer(
            context.authUserId,
            authUserEmail,
            context.userName,
            context.emailVerified ?? false
        );

        assertCustomerSelfServiceAccess(customer.status, "profileWrite");

        customerId = customer.id;
        customerType = "registered";
        customerEmail = customer.email;
        customerName = [customer.firstName, customer.lastName].filter(Boolean).join(" ") || context.userName || null;
        customerPhone = customer.phone ?? validated.customer?.phone ?? null;
    } else {
        // Guest customer
        if (!validated.customer?.email) {
            throw new BadRequestError("Customer details with valid email are required for guest checkout");
        }

        const normalizedEmail = validated.customer.email.trim().toLowerCase();
        customerType = "guest";
        customerEmail = normalizedEmail;
        customerName = [validated.customer.firstName, validated.customer.lastName].filter(Boolean).join(" ") || null;
        customerPhone = validated.customer.phone ?? null;

        // Find existing customer records matching this email
        const matchingCustomers = await db.query.customersTable.findMany({
            where: and(
                eq(sql`LOWER(${customersTable.email})`, normalizedEmail),
                isNull(customersTable.deletedAt)
            ),
        });

        // Security Guard: reject guest checkout if any profile under this email is suspended or archived
        const hasBlockedCustomer = matchingCustomers.some(
            (c) => c.status === "suspended" || c.status === "archived"
        );
        if (hasBlockedCustomer) {
            throw new ForbiddenError("Customer access is unavailable");
        }

        // Reuse an existing active guest customer profile that is unlinked (authUserId is null)
        const existingGuest = matchingCustomers.find(
            (c) => c.customerType === "guest" && c.authUserId === null && c.status === "active"
        );

        if (existingGuest) {
            customerId = existingGuest.id;
        } else {
            const [newGuest] = await db
                .insert(customersTable)
                .values({
                    customerType: "guest",
                    status: "active",
                    email: normalizedEmail,
                    firstName: validated.customer.firstName ?? null,
                    lastName: validated.customer.lastName ?? null,
                    phone: validated.customer.phone ?? null,
                    tags: ["guest-checkout"],
                    metadata: {
                        guestCheckoutIp: context?.clientIp ?? null,
                        userAgent: context?.userAgent ?? null,
                    },
                })
                .returning();

            if (!newGuest) {
                throw new BadRequestError("Failed to initialize guest customer");
            }
            customerId = newGuest.id;
        }
    }

    // 3. Resolve Shipping Address
    let shippingAddressSnapshot: TCheckoutAddress;

    if ("addressId" in validated.shippingAddress) {
        // Saved address lookup
        const saved = await db.query.customerAddressesTable.findFirst({
            where: and(
                eq(customerAddressesTable.id, validated.shippingAddress.addressId),
                eq(customerAddressesTable.customerId, customerId),
                isNull(customerAddressesTable.deletedAt)
            ),
        });

        if (!saved) {
            throw new NotFoundError("Selected shipping address not found or does not belong to this customer");
        }

        shippingAddressSnapshot = CheckoutAddressSchema.parse({
            recipientName: saved.recipientName,
            company: saved.company,
            phone: saved.phone,
            addressLine1: saved.addressLine1,
            addressLine2: saved.addressLine2,
            city: saved.city,
            state: saved.state,
            postalCode: saved.postalCode,
            countryCode: saved.countryCode,
        });
    } else {
        shippingAddressSnapshot = CheckoutAddressSchema.parse(validated.shippingAddress);

        // Save new address to profile if requested for registered customer
        if (validated.saveShippingAddress && customerType === "registered") {
            try {
                await customerActions.addCustomerAddress(customerId, {
                    ...shippingAddressSnapshot,
                    addressType: "shipping",
                    isDefaultShipping: false,
                    isDefaultBilling: false,
                });
            } catch {
                // Non-blocking address save
            }
        }
    }

    // 4. Resolve Billing Address
    let billingAddressSnapshot: TCheckoutAddress;

    if (!validated.billingAddress || ("sameAsShipping" in validated.billingAddress && validated.billingAddress.sameAsShipping)) {
        billingAddressSnapshot = shippingAddressSnapshot;
    } else if ("addressId" in validated.billingAddress) {
        const savedBilling = await db.query.customerAddressesTable.findFirst({
            where: and(
                eq(customerAddressesTable.id, validated.billingAddress.addressId),
                eq(customerAddressesTable.customerId, customerId),
                isNull(customerAddressesTable.deletedAt)
            ),
        });

        if (!savedBilling) {
            throw new NotFoundError("Selected billing address not found or does not belong to this customer");
        }

        billingAddressSnapshot = CheckoutAddressSchema.parse({
            recipientName: savedBilling.recipientName,
            company: savedBilling.company,
            phone: savedBilling.phone,
            addressLine1: savedBilling.addressLine1,
            addressLine2: savedBilling.addressLine2,
            city: savedBilling.city,
            state: savedBilling.state,
            postalCode: savedBilling.postalCode,
            countryCode: savedBilling.countryCode,
        });
    } else {
        billingAddressSnapshot = CheckoutAddressSchema.parse(validated.billingAddress);
    }

    // 5. Resolve Snapshots and Validate Purchasability
    const snapshots = await getVariantCheckoutSnapshots(variantIds);
    const snapshotMap = new Map<string, TVariantCheckoutSnapshot>(
        snapshots.map((s) => [s.variantId, s])
    );

    const pricingItems: CheckoutPricingItemInput[] = [];
    const itemsToReserve: Array<{
        variantId: string;
        quantity: number;
        snapshot: TVariantCheckoutSnapshot;
    }> = [];

    for (const [variantId, quantity] of itemQuantityMap.entries()) {
        const snap = snapshotMap.get(variantId);
        if (!snap) {
            throw new NotFoundError(`Variant '${variantId}' was not found`);
        }

        if (!snap.isPurchasable) {
            throw new ConflictError(
                `Item '${snap.title} (${snap.variantTitle})' is unavailable or out of stock`
            );
        }

        if (!snap.isUnlimited && !snap.allowBackorder && (snap.availableStock == null || snap.availableStock < quantity)) {
            throw new ConflictError(
                `Insufficient stock for '${snap.title} (${snap.variantTitle})'. Requested: ${quantity}, Available: ${snap.availableStock ?? 0}`
            );
        }

        pricingItems.push({ snapshot: snap, quantity });
        itemsToReserve.push({ variantId, quantity, snapshot: snap });
    }

    // 6. Calculate Pricing
    const pricing = calculateCheckoutPricing(pricingItems);

    // 7. Generate Cryptographic Guest Access Token (if guest)
    let guestAccessToken: string | null = null;
    let guestAccessTokenHash: string | null = null;
    if (customerType === "guest") {
        const generated = generateGuestAccessToken();
        guestAccessToken = generated.token;
        guestAccessTokenHash = generated.hash;
    }

    // 8. Reserve Inventory (with automatic compensation on conflict/failure)
    const reservedBatch: Array<{ variantId: string; quantity: number }> = [];
    const reservationResults = new Map<string, { isBackordered: boolean }>();

    try {
        for (const item of itemsToReserve) {
            const res = await reserveVariantInventory({
                variantId: item.variantId,
                quantity: item.quantity,
            });
            reservedBatch.push({ variantId: item.variantId, quantity: item.quantity });
            reservationResults.set(item.variantId, { isBackordered: res.isBackordered });
        }
    } catch (reserveError) {
        // Rollback reserved items
        for (const reserved of reservedBatch) {
            try {
                await releaseVariantInventory({
                    variantId: reserved.variantId,
                    quantity: reserved.quantity,
                });
            } catch {
                // Best-effort rollback
            }
        }
        throw reserveError;
    }

    // 9. Create Order & Order Items
    const orderNumber = generateOrderNumber();
    const logisticsSnapshot: TConsignmentLogisticsSnapshot = {
        totalActualWeight: pricing.logistics.totalActualWeight,
        totalVolumeCm3: pricing.logistics.totalVolumeCm3,
        aggregateVolumetricWeight: pricing.logistics.aggregateVolumetricWeight,
        chargeableWeight: pricing.logistics.chargeableWeight,
        pieceChargeableWeight: pricing.logistics.pieceChargeableWeight,
        hasPhysicalGoods: pricing.logistics.hasPhysicalGoods,
    };

    let createdOrder: typeof ordersTable.$inferSelect;
    try {
        const [order] = await db
            .insert(ordersTable)
            .values({
                orderNumber,
                customerId,
                customerType,
                customerEmail,
                customerName,
                customerPhone,
                status: "pending",
                paymentStatus: "pending",
                paymentMethod: validated.paymentMethod,
                currency: pricing.currency,
                subtotal: pricing.subtotal.toFixed(2),
                shippingFee: pricing.shippingFee.toFixed(2),
                tax: pricing.tax.toFixed(2),
                discount: pricing.discount.toFixed(2),
                totalAmount: pricing.totalAmount.toFixed(2),
                shippingAddress: shippingAddressSnapshot as unknown as TCheckoutAddressSnapshot,
                billingAddress: billingAddressSnapshot as unknown as TCheckoutAddressSnapshot,
                logistics: logisticsSnapshot,
                notes: validated.notes ?? null,
                metadata: validated.metadata ?? {},
                guestAccessTokenHash,
            })
            .returning();

        if (!order) {
            throw new BadRequestError("Failed to record checkout order");
        }
        createdOrder = order;
    } catch (orderInsertError) {
        // Release reserved inventory if order insertion failed
        for (const reserved of reservedBatch) {
            try {
                await releaseVariantInventory({
                    variantId: reserved.variantId,
                    quantity: reserved.quantity,
                });
            } catch {
                // Best-effort rollback
            }
        }
        throw orderInsertError;
    }

    // Insert order items
    const lineItemValues = itemsToReserve.map((item) => {
        const isBackordered = reservationResults.get(item.variantId)?.isBackordered ?? false;
        const lineTotalPrice = roundToDecimals(item.snapshot.currentPrice * item.quantity, 2);

        return {
            orderId: createdOrder.id,
            productId: item.snapshot.productId,
            variantId: item.snapshot.variantId,
            title: item.snapshot.title,
            variantTitle: item.snapshot.variantTitle,
            sku: item.snapshot.sku,
            slug: item.snapshot.slug,
            imageUrl: item.snapshot.imageUrl ?? null,
            unitPrice: item.snapshot.currentPrice.toFixed(2),
            quantity: item.quantity,
            totalPrice: lineTotalPrice.toFixed(2),
            weight: item.snapshot.weight != null ? item.snapshot.weight : null,
            isBackordered,
            snapshot: item.snapshot,
        };
    });

    let createdItems: Array<typeof orderItemsTable.$inferSelect>;
    try {
        createdItems = await db.insert(orderItemsTable).values(lineItemValues).returning();
    } catch (itemsInsertError) {
        // If order items fail, clean up order and release stock
        try {
            await db.delete(ordersTable).where(eq(ordersTable.id, createdOrder.id));
            for (const reserved of reservedBatch) {
                await releaseVariantInventory({
                    variantId: reserved.variantId,
                    quantity: reserved.quantity,
                });
            }
        } catch {
            // Best effort cleanup
        }
        throw itemsInsertError;
    }

    // 9. Update Customer Statistics & Record Security Audit Log
    try {
        await db
            .update(customersTable)
            .set({
                totalOrders: sql`${customersTable.totalOrders} + 1`,
                totalSpent: sql`${customersTable.totalSpent} + ${pricing.totalAmount}`,
                lastOrderAt: new Date(),
            })
            .where(eq(customersTable.id, customerId));

        await recordCustomerAuditLog({
            customerId,
            actorId: context?.authUserId ?? customerId,
            actorType: context?.authUserId ? "customer" : "system",
            action: "order_placed",
            changes: {
                orderId: createdOrder.id,
                orderNumber: createdOrder.orderNumber,
                totalAmount: pricing.totalAmount,
                itemCount: itemsToReserve.length,
                paymentMethod: validated.paymentMethod,
            },
            headers: context?.headers,
            ipAddress: context?.clientIp,
            userAgent: context?.userAgent,
        });
    } catch {
        // Non-blocking post-checkout hooks
    }

    return OrderDTOSchema.parse({
        ...createdOrder,
        guestAccessToken,
        items: createdItems,
    });
}

/**
 * Retrieves order by ID with ownership/access verification.
 * Supports:
 * - Admin users (full access)
 * - Authenticated customers (must own the order)
 * - Guest customers (must present a valid cryptographic guestAccessToken)
 */
export async function getOrderById(
    orderId: string,
    access?: {
        authUserId?: string;
        guestAccessToken?: string;
        isAdmin?: boolean;
    }
): Promise<TOrderDTO> {
    const order = await db.query.ordersTable.findFirst({
        where: eq(ordersTable.id, orderId),
        with: {
            items: true,
            customer: true,
        },
    });

    if (!order) {
        throw new NotFoundError("Order not found");
    }

    if (access?.isAdmin) {
        return OrderDTOSchema.parse(order);
    }

    if (access?.authUserId && order.customer?.authUserId === access.authUserId) {
        return OrderDTOSchema.parse(order);
    }

    if (
        access?.guestAccessToken &&
        order.guestAccessTokenHash &&
        verifyGuestAccessToken(access.guestAccessToken, order.guestAccessTokenHash)
    ) {
        return OrderDTOSchema.parse(order);
    }

    throw new ForbiddenError("You are not authorized to view this order");
}

/**
 * Cancels a pending/processing order and safely restores inventory.
 */
export async function cancelOrder(
    orderId: string,
    access: {
        authUserId?: string;
        guestAccessToken?: string;
        isAdmin?: boolean;
        reason?: string;
        clientIp?: string;
        headers?: Headers;
    }
): Promise<TOrderDTO> {
    const order = await db.query.ordersTable.findFirst({
        where: eq(ordersTable.id, orderId),
        with: {
            items: true,
            customer: true,
            statusConfig: true,
        },
    });

    if (!order) {
        throw new NotFoundError("Order not found");
    }

    // Ownership check
    const isAuthOwner = Boolean(access.authUserId && order.customer?.authUserId === access.authUserId);
    const isGuestOwner = Boolean(
        access.guestAccessToken &&
        order.guestAccessTokenHash &&
        verifyGuestAccessToken(access.guestAccessToken, order.guestAccessTokenHash)
    );

    if (!access.isAdmin && !isAuthOwner && !isGuestOwner) {
        throw new ForbiddenError("You are not authorized to cancel this order");
    }

    // Status / Permission check against order_statuses configuration
    const isCancellableByActor = access.isAdmin
        ? (order.statusConfig?.allowAdminCancel ?? CANCELLABLE_ORDER_STATUSES.includes(order.status as TOrderStatus))
        : (order.statusConfig?.allowCustomerCancel ?? (order.status === "pending" || order.status === "confirmed"));

    if (!isCancellableByActor) {
        throw new ConflictError(
            `Cannot cancel order in '${order.status}' status. ${
                access.isAdmin
                    ? "Admin cancellation is not permitted for this order status."
                    : "Customer cancellation is not permitted for this order status."
            }`
        );
    }

    const updatedNotes = access.reason
        ? order.notes
            ? `${order.notes} | Cancellation Reason: ${access.reason}`
            : `Cancellation Reason: ${access.reason}`
        : order.notes;

    const restockRule = order.statusConfig?.restockRule ?? "immediate";
    const newRestockStatus = restockRule === "immediate"
        ? "restocked"
        : (restockRule === "hold_for_inspection" ? "pending_inspection" : "not_applicable");

    // 1. Atomically claim cancellation FIRST to prevent concurrent double-cancel / phantom stock release
    const [updatedOrder] = await db
        .update(ordersTable)
        .set({
            status: "cancelled",
            cancelledAt: new Date(),
            notes: updatedNotes,
            restockStatus: newRestockStatus,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(ordersTable.id, orderId),
                eq(ordersTable.status, order.status)
            )
        )
        .returning();

    if (!updatedOrder) {
        throw new ConflictError(
            "Order could not be cancelled because its status has changed or cancellation is already being processed."
        );
    }

    // 2. Release reserved inventory if restockRule is immediate
    if (restockRule === "immediate") {
        for (const item of order.items) {
            if (item.variantId) {
                try {
                    await releaseVariantInventory({
                        variantId: item.variantId,
                        quantity: item.quantity,
                    });
                } catch {
                    // Best effort release
                }
            }
        }
    }

    // 3. Reverse customer statistics if applicable
    if (order.customerId) {
        try {
            await db
                .update(customersTable)
                .set({
                    totalOrders: sql`GREATEST(0, ${customersTable.totalOrders} - 1)`,
                    totalSpent: sql`GREATEST(0, ${customersTable.totalSpent} - ${Number(order.totalAmount)})`,
                })
                .where(eq(customersTable.id, order.customerId));

            await recordCustomerAuditLog({
                customerId: order.customerId,
                actorId: access.authUserId ?? order.customerId,
                actorType: access.isAdmin ? "admin" : "customer",
                action: "order_cancelled",
                changes: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    reason: access.reason ?? null,
                    restockStatus: newRestockStatus,
                },
                headers: access.headers,
                ipAddress: access.clientIp,
            });
        } catch {
            // Non-blocking
        }
    }

    return OrderDTOSchema.parse({
        ...updatedOrder,
        items: order.items,
    });
}

/**
 * Lists orders for a customer with pagination.
 */
export async function listCustomerOrders(
    customerId: string,
    query: TCustomerOrderListQuery
): Promise<CustomerOrderListResponse> {
    const validated = CustomerOrderListQuerySchema.parse(query);

    const conditions = [eq(ordersTable.customerId, customerId)];
    if (validated.status) {
        conditions.push(eq(ordersTable.status, validated.status));
    }

    const whereClause = and(...conditions);
    const limit = validated.limit;
    const page = validated.page;
    const offset = (page - 1) * limit;

    const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersTable)
        .where(whereClause);

    const totalCount = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const orders = await db.query.ordersTable.findMany({
        where: whereClause,
        orderBy: [desc(ordersTable.createdAt)],
        limit,
        offset,
        with: {
            items: true,
        },
    });

    return {
        items: orders.map((o) => OrderDTOSchema.parse(o)),
        pagination: {
            totalCount,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
}

/**
 * Admin: List orders with pagination and filtering by status, paymentStatus, and search.
 */
export async function listOrdersAdmin(
    query: TAdminOrderListQuery
): Promise<AdminOrderListResponse> {
    const validated = AdminOrderListQuerySchema.parse(query);

    const conditions = [];
    if (validated.status) {
        conditions.push(eq(ordersTable.status, validated.status));
    }
    if (validated.paymentStatus) {
        conditions.push(eq(ordersTable.paymentStatus, validated.paymentStatus));
    }
    if (validated.search) {
        const term = `%${validated.search}%`;
        conditions.push(
            or(
                ilike(ordersTable.orderNumber, term),
                ilike(ordersTable.customerEmail, term),
                ilike(ordersTable.customerName, term)
            )
        );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const limit = validated.limit;
    const page = validated.page;
    const offset = (page - 1) * limit;

    const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(ordersTable)
        .where(whereClause);

    const totalCount = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const orders = await db.query.ordersTable.findMany({
        where: whereClause,
        orderBy: [desc(ordersTable.createdAt)],
        limit,
        offset,
        with: {
            items: true,
            customer: true,
        },
    });

    return {
        items: orders.map((o) => OrderDTOSchema.parse(o)),
        pagination: {
            totalCount,
            page,
            limit,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
        },
    };
}

/**
 * Admin: Get complete order detail by ID.
 */
export async function getOrderAdminById(orderId: string): Promise<TOrderDTO> {
    const order = await db.query.ordersTable.findFirst({
        where: eq(ordersTable.id, orderId),
        with: {
            items: true,
            customer: true,
        },
    });

    if (!order) {
        throw new NotFoundError("Order not found");
    }

    return OrderDTOSchema.parse(order);
}

/**
 * Admin: Update order status following the configurable order_statuses workflow state machine.
 */
export async function updateOrderStatusAdmin(
    orderId: string,
    input: TAdminOrderStatusTransitionInput,
    adminMeta: {
        adminId: string;
        clientIp?: string;
        userAgent?: string;
        headers?: Headers;
    }
): Promise<TOrderDTO> {
    const validated = AdminOrderStatusTransitionInputSchema.parse(input);

    const order = await db.query.ordersTable.findFirst({
        where: eq(ordersTable.id, orderId),
        with: {
            items: true,
            customer: true,
            statusConfig: true,
        },
    });

    if (!order) {
        throw new NotFoundError("Order not found");
    }

    // If transitioning to cancelled, delegate directly to cancelOrder to handle inventory and spend reversal
    if (validated.status === "cancelled") {
        return cancelOrder(orderId, {
            isAdmin: true,
            reason: validated.reason,
            clientIp: adminMeta.clientIp,
            headers: adminMeta.headers,
        });
    }

    // No-op if target status is identical to current status
    if (validated.status === order.status) {
        return OrderDTOSchema.parse(order);
    }

    // Enforce workflow transitions defined in order_statuses
    const allowedTransitions = order.statusConfig?.allowedNextStatuses ?? [];
    if (!allowedTransitions.includes(validated.status)) {
        throw new ConflictError(
            `Transition from '${order.status}' to '${validated.status}' is not allowed. Allowed transitions: ${
                allowedTransitions.length > 0 ? allowedTransitions.join(", ") : "none"
            }`
        );
    }

    // Fetch configuration for the target status
    const targetStatus = await db.query.orderStatusesTable.findFirst({
        where: eq(orderStatusesTable.code, validated.status),
    });

    if (!targetStatus) {
        throw new BadRequestError(`Target order status '${validated.status}' is not recognized`);
    }

    // Check tracking number requirements for physical goods
    const hasPhysicalGoods = order.logistics?.hasPhysicalGoods !== false;
    const existingTracking = (order.metadata as Record<string, unknown> | null)?.trackingNumber;
    if (targetStatus.requireTrackingToEnter && hasPhysicalGoods && !validated.trackingNumber && !existingTracking) {
        throw new BadRequestError(`Tracking number is required to transition order to '${validated.status}'`);
    }

    // Calculate side effects
    const deliveredAt = validated.status === "delivered" ? (order.deliveredAt ?? new Date()) : order.deliveredAt;

    let paymentStatus = order.paymentStatus;
    let paidAt = order.paidAt;
    if (targetStatus.autoMarkCodPaid && order.paymentMethod === "cod" && order.paymentStatus === "pending") {
        paymentStatus = "paid";
        paidAt = new Date();
    }

    const updatedNotes = validated.notes || validated.reason
        ? order.notes
            ? `${order.notes} | ${validated.notes || `Status Reason: ${validated.reason}`}`
            : (validated.notes || `Status Reason: ${validated.reason}`)
        : order.notes;

    const trackingMetadata: Record<string, unknown> = {};
    if (validated.trackingNumber) trackingMetadata.trackingNumber = validated.trackingNumber;
    if (validated.carrier) trackingMetadata.carrier = validated.carrier;
    if (validated.trackingUrl) trackingMetadata.trackingUrl = validated.trackingUrl;

    const updatedMetadata = {
        ...(order.metadata || {}),
        ...trackingMetadata,
        ...(validated.reason ? { lastStatusChangeReason: validated.reason } : {}),
    };

    // Atomically update order status with concurrency check
    const [updatedOrder] = await db
        .update(ordersTable)
        .set({
            status: validated.status,
            deliveredAt,
            paidAt,
            paymentStatus,
            notes: updatedNotes,
            metadata: updatedMetadata,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(ordersTable.id, orderId),
                eq(ordersTable.status, order.status)
            )
        )
        .returning();

    if (!updatedOrder) {
        throw new ConflictError(
            "Order status could not be updated because its status was modified concurrently by another process."
        );
    }

    // Record customer audit log
    if (order.customerId) {
        try {
            await recordCustomerAuditLog({
                customerId: order.customerId,
                actorId: adminMeta.adminId,
                actorType: "admin",
                action: "order_status_updated",
                changes: {
                    orderId: order.id,
                    orderNumber: order.orderNumber,
                    fromStatus: order.status,
                    toStatus: validated.status,
                    trackingNumber: validated.trackingNumber ?? null,
                    carrier: validated.carrier ?? null,
                    paymentStatus,
                },
                headers: adminMeta.headers,
                ipAddress: adminMeta.clientIp,
                userAgent: adminMeta.userAgent,
            });
        } catch {
            // Non-blocking
        }
    }

    return OrderDTOSchema.parse({
        ...updatedOrder,
        items: order.items,
    });
}

const checkoutActions = {
    estimateCheckout,
    processCheckout,
    getOrderById,
    cancelOrder,
    listCustomerOrders,
    listOrdersAdmin,
    getOrderAdminById,
    updateOrderStatusAdmin,
    generateOrderNumber,
    generateGuestAccessToken,
    hashGuestAccessToken,
    verifyGuestAccessToken,
};

export default checkoutActions;
