import { db } from "@/lib/drizzle";
import { account, user } from "@/lib/drizzle/schemas/auth";
import { customerAddressesTable, customerAuditLogsTable, customersTable, type TCustomerAuditAction } from "@/lib/drizzle/schemas/public";
import { BadRequestError, NotFoundError } from "@/lib/error";
import { logger } from "@/lib/pino/logger";
import { verifyPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";
import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { extractClientNetworkMeta, recordCustomerAuditLog } from "./audit";
import {
    type ClientAuditMeta,
    CustomerAdminDetailSchema,
    CustomerAddressDTOSchema,
    CustomerAuditLogDTOSchema,
    CustomerDataExportSchema,
    CustomerPublicProfileSchema,
    MAX_CUSTOMER_ADDRESSES,
    type TAdminUpdateCustomerInput,
    type TCreateCustomerAddressInput,
    type TCustomerAddressDTO,
    type TCustomerAdminDetail,
    type TCustomerAdminList,
    type TCustomerAnonymizeInput,
    type TCustomerAuditLogListQuery,
    type TCustomerAuditLogListResponse,
    type TCustomerDataExport,
    type TCustomerListQuery,
    type TCustomerPublicProfile,
    type TSetDefaultAddressType,
    type TUpdateCustomerAddressInput,
    type TUpdateCustomerProfileInput,
} from "./types";

/**
 * Split a full name into first and last name.
 */
function splitFullName(name?: string | null): { firstName: string | null; lastName: string | null } {
    if (!name || !name.trim()) {
        return { firstName: null, lastName: null };
    }
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return { firstName: parts[0] ?? null, lastName: null };
    }
    return {
        firstName: parts[0] ?? null,
        lastName: parts.slice(1).join(" ") || null,
    };
}

/**
 * Resilient lazy upsert gateway for authenticated users.
 * Finds customer by authUserId; if not found, matches by email (and binds authUserId);
 * if still not found, inserts new customer record.
 */
export async function getOrCreateCustomer(
    authUserId: string,
    email: string,
    name?: string | null
): Promise<TCustomerPublicProfile> {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Try finding by authUserId
    const existingByAuth = await db.query.customersTable.findFirst({
        where: and(eq(customersTable.authUserId, authUserId), isNull(customersTable.deletedAt)),
        with: {
            addresses: {
                where: isNull(customerAddressesTable.deletedAt),
            },
        },
    });

    if (existingByAuth) {
        return CustomerPublicProfileSchema.parse(existingByAuth);
    }

    // 2. Try finding by email (e.g. created previously as guest or before OAuth link)
    const existingByEmail = await db.query.customersTable.findFirst({
        where: and(
            eq(sql`LOWER(${customersTable.email})`, normalizedEmail),
            isNull(customersTable.deletedAt)
        ),
        with: {
            addresses: {
                where: isNull(customerAddressesTable.deletedAt),
            },
        },
    });

    if (existingByEmail) {
        // Link authUserId if not already linked
        if (!existingByEmail.authUserId) {
            const [updated] = await db
                .update(customersTable)
                .set({
                    authUserId,
                    customerType: "registered",
                    updatedAt: new Date(),
                })
                .where(eq(customersTable.id, existingByEmail.id))
                .returning();

            if (updated) {
                return CustomerPublicProfileSchema.parse({
                    ...updated,
                    addresses: existingByEmail.addresses,
                });
            }
        }
        return CustomerPublicProfileSchema.parse(existingByEmail);
    }

    // 3. Create new customer
    const { firstName, lastName } = splitFullName(name);
    try {
        const [inserted] = await db
            .insert(customersTable)
            .values({
                authUserId,
                email: normalizedEmail,
                firstName,
                lastName,
                customerType: "registered",
                status: "active",
            })
            .returning();

        if (!inserted) {
            throw new Error("Failed to insert customer record");
        }

        return CustomerPublicProfileSchema.parse({
            ...inserted,
            addresses: [],
        });
    } catch (err: unknown) {
        logger.warn({
            message: "Conflict or error during customer insertion, attempting fallback lookup",
            error: err,
        });
        // Handle race conditions where another concurrent request created the record
        const fallback = await db.query.customersTable.findFirst({
            where: or(
                eq(customersTable.authUserId, authUserId),
                eq(sql`LOWER(${customersTable.email})`, normalizedEmail)
            ),
            with: {
                addresses: {
                    where: isNull(customerAddressesTable.deletedAt),
                },
            },
        });

        if (fallback) {
            return CustomerPublicProfileSchema.parse(fallback);
        }
        throw err;
    }
}

/**
 * Get customer profile by customer ID or authUserId.
 */
export async function getCustomerProfile(
    identifier: { customerId?: string; authUserId?: string }
): Promise<TCustomerPublicProfile> {
    const condition = identifier.customerId
        ? eq(customersTable.id, identifier.customerId)
        : identifier.authUserId
          ? eq(customersTable.authUserId, identifier.authUserId)
          : null;

    if (!condition) {
        throw new BadRequestError("Customer ID or authUserId is required");
    }

    const customer = await db.query.customersTable.findFirst({
        where: and(condition, isNull(customersTable.deletedAt)),
        with: {
            addresses: {
                where: isNull(customerAddressesTable.deletedAt),
                orderBy: [desc(customerAddressesTable.createdAt)],
            },
        },
    });

    if (!customer) {
        throw new NotFoundError("Customer not found");
    }

    return CustomerPublicProfileSchema.parse(customer);
}

/**
 * Update customer's own profile information.
 */
export async function updateCustomerProfile(
    customerId: string,
    data: TUpdateCustomerProfileInput,
    clientMeta?: ClientAuditMeta
): Promise<TCustomerPublicProfile> {
    const existing = await db.query.customersTable.findFirst({
        where: and(eq(customersTable.id, customerId), isNull(customersTable.deletedAt)),
    });

    if (!existing) {
        throw new NotFoundError("Customer not found");
    }

    const [updated] = await db
        .update(customersTable)
        .set({
            ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
            ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
            updatedAt: new Date(),
        })
        .where(eq(customersTable.id, customerId))
        .returning();

    if (!updated) {
        throw new NotFoundError("Customer not found");
    }

    // Record audit log for profile update with diff of changed fields
    const diff: Record<string, unknown> = {};
    if (data.firstName !== undefined && data.firstName !== existing.firstName) {
        diff.firstName = { from: existing.firstName, to: data.firstName };
    }
    if (data.lastName !== undefined && data.lastName !== existing.lastName) {
        diff.lastName = { from: existing.lastName, to: data.lastName };
    }
    if (data.phone !== undefined && data.phone !== existing.phone) {
        diff.phone = { from: existing.phone, to: data.phone };
    }
    if (data.avatarUrl !== undefined && data.avatarUrl !== existing.avatarUrl) {
        diff.avatarUrl = { from: existing.avatarUrl, to: data.avatarUrl };
    }

    if (Object.keys(diff).length > 0) {
        await recordCustomerAuditLog({
            customerId,
            actorId: clientMeta?.actorId ?? existing.authUserId,
            actorType: clientMeta?.actorType ?? "customer",
            action: "profile_updated",
            changes: diff,
            headers: clientMeta?.headers,
            ipAddress: clientMeta?.ipAddress,
            userAgent: clientMeta?.userAgent,
        });
    }

    return getCustomerProfile({ customerId });
}

/**
 * Get all active addresses for a customer.
 */
export async function getCustomerAddresses(customerId: string): Promise<TCustomerAddressDTO[]> {
    const addresses = await db.query.customerAddressesTable.findMany({
        where: and(
            eq(customerAddressesTable.customerId, customerId),
            isNull(customerAddressesTable.deletedAt)
        ),
        orderBy: [
            desc(customerAddressesTable.isDefaultShipping),
            desc(customerAddressesTable.isDefaultBilling),
            desc(customerAddressesTable.createdAt),
        ],
    });

    return addresses.map((addr) => CustomerAddressDTOSchema.parse(addr));
}

/**
 * Helper to construct atomic SQL expression for default address swap.
 */
export function buildAtomicDefaultAddressSql(
    customerId: string,
    targetAddressId: string,
    field: "is_default_shipping" | "is_default_billing"
) {
    if (field === "is_default_shipping") {
        return sql`
            UPDATE customer_addresses
            SET is_default_shipping = (id = ${targetAddressId}::uuid),
                updated_at = NOW()
            WHERE customer_id = ${customerId}::uuid
              AND (id = ${targetAddressId}::uuid OR is_default_shipping = true)
              AND deleted_at IS NULL
        `;
    }

    return sql`
        UPDATE customer_addresses
        SET is_default_billing = (id = ${targetAddressId}::uuid),
            updated_at = NOW()
        WHERE customer_id = ${customerId}::uuid
          AND (id = ${targetAddressId}::uuid OR is_default_billing = true)
          AND deleted_at IS NULL
    `;
}

/**
 * Set an address as default shipping or billing atomically.
 */
export async function setDefaultAddress(
    customerId: string,
    addressId: string,
    type: TSetDefaultAddressType,
    clientMeta?: ClientAuditMeta
): Promise<TCustomerAddressDTO> {
    // 1. Verify target address belongs to customer and is not soft deleted
    const target = await db.query.customerAddressesTable.findFirst({
        where: and(
            eq(customerAddressesTable.id, addressId),
            eq(customerAddressesTable.customerId, customerId),
            isNull(customerAddressesTable.deletedAt)
        ),
    });

    if (!target) {
        throw new NotFoundError("Address not found");
    }

    // 2. Execute single-statement atomic SQL CASE expression
    const field = type === "shipping" ? "is_default_shipping" : "is_default_billing";
    const updateSql = buildAtomicDefaultAddressSql(customerId, addressId, field);
    await db.execute(updateSql);

    // 3. Return updated target address
    const updated = await db.query.customerAddressesTable.findFirst({
        where: eq(customerAddressesTable.id, addressId),
    });

    if (!updated) {
        throw new NotFoundError("Address not found");
    }

    await recordCustomerAuditLog({
        customerId,
        actorId: clientMeta?.actorId ?? null,
        actorType: clientMeta?.actorType ?? "customer",
        action: "default_address_changed",
        changes: {
            addressId,
            defaultType: type,
        },
        headers: clientMeta?.headers,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
    });

    return CustomerAddressDTOSchema.parse(updated);
}

/**
 * Add a new customer address with 25-address quota enforcement.
 */
export async function addCustomerAddress(
    customerId: string,
    data: TCreateCustomerAddressInput,
    clientMeta?: ClientAuditMeta
): Promise<TCustomerAddressDTO> {
    // 1. Quota check: active addresses count
    const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customerAddressesTable)
        .where(
            and(
                eq(customerAddressesTable.customerId, customerId),
                isNull(customerAddressesTable.deletedAt)
            )
        );

    const activeCount = countResult?.count ?? 0;
    if (activeCount >= MAX_CUSTOMER_ADDRESSES) {
        throw new BadRequestError(`Address limit reached (maximum ${MAX_CUSTOMER_ADDRESSES} addresses allowed)`);
    }

    // 2. Determine defaults: if first address, automatically make it default shipping and billing
    const isFirstAddress = activeCount === 0;
    const shouldDefaultShipping = isFirstAddress || Boolean(data.isDefaultShipping);
    const shouldDefaultBilling = isFirstAddress || Boolean(data.isDefaultBilling);

    // If making default, reset existing defaults first or insert then atomic update
    const [newAddress] = await db
        .insert(customerAddressesTable)
        .values({
            customerId,
            recipientName: data.recipientName,
            company: data.company ?? null,
            phone: data.phone,
            addressLine1: data.addressLine1,
            addressLine2: data.addressLine2 ?? null,
            city: data.city,
            state: data.state ?? null,
            postalCode: data.postalCode,
            countryCode: data.countryCode,
            addressType: data.addressType ?? "both",
            isDefaultShipping: false,
            isDefaultBilling: false,
        })
        .returning();

    if (!newAddress) {
        throw new Error("Failed to create customer address");
    }

    // Atomically promote defaults if requested
    if (shouldDefaultShipping) {
        await setDefaultAddress(customerId, newAddress.id, "shipping", clientMeta);
    }
    if (shouldDefaultBilling) {
        await setDefaultAddress(customerId, newAddress.id, "billing", clientMeta);
    }

    const finalAddress = await db.query.customerAddressesTable.findFirst({
        where: eq(customerAddressesTable.id, newAddress.id),
    });

    await recordCustomerAuditLog({
        customerId,
        actorId: clientMeta?.actorId ?? null,
        actorType: clientMeta?.actorType ?? "customer",
        action: "address_created",
        changes: {
            addressId: newAddress.id,
            recipientName: newAddress.recipientName,
            city: newAddress.city,
            postalCode: newAddress.postalCode,
            countryCode: newAddress.countryCode,
            addressType: newAddress.addressType,
        },
        headers: clientMeta?.headers,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
    });

    return CustomerAddressDTOSchema.parse(finalAddress);
}

/**
 * Update an existing customer address.
 */
export async function updateCustomerAddress(
    customerId: string,
    addressId: string,
    data: TUpdateCustomerAddressInput,
    clientMeta?: ClientAuditMeta
): Promise<TCustomerAddressDTO> {
    const existing = await db.query.customerAddressesTable.findFirst({
        where: and(
            eq(customerAddressesTable.id, addressId),
            eq(customerAddressesTable.customerId, customerId),
            isNull(customerAddressesTable.deletedAt)
        ),
    });

    if (!existing) {
        throw new NotFoundError("Address not found");
    }

    const { isDefaultShipping, isDefaultBilling, ...directFields } = data;

    const [updated] = await db
        .update(customerAddressesTable)
        .set({
            ...directFields,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(customerAddressesTable.id, addressId),
                eq(customerAddressesTable.customerId, customerId)
            )
        )
        .returning();

    if (!updated) {
        throw new NotFoundError("Address not found");
    }

    if (isDefaultShipping) {
        await setDefaultAddress(customerId, addressId, "shipping", clientMeta);
    }
    if (isDefaultBilling) {
        await setDefaultAddress(customerId, addressId, "billing", clientMeta);
    }

    const finalAddress = await db.query.customerAddressesTable.findFirst({
        where: eq(customerAddressesTable.id, addressId),
    });

    // Record audit log for address update with diff
    const diff: Record<string, unknown> = { addressId };
    for (const [key, value] of Object.entries(data)) {
        if (value !== undefined && (existing as Record<string, unknown>)[key] !== value) {
            diff[key] = { from: (existing as Record<string, unknown>)[key], to: value };
        }
    }

    await recordCustomerAuditLog({
        customerId,
        actorId: clientMeta?.actorId ?? null,
        actorType: clientMeta?.actorType ?? "customer",
        action: "address_updated",
        changes: diff,
        headers: clientMeta?.headers,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
    });

    return CustomerAddressDTOSchema.parse(finalAddress);
}

/**
 * Soft delete customer address. If a default address is deleted,
 * fall back by promoting the most recently created remaining address as default.
 */
export async function deleteCustomerAddress(
    customerId: string,
    addressId: string,
    clientMeta?: ClientAuditMeta
): Promise<{ success: boolean; deletedAddressId: string }> {
    const existing = await db.query.customerAddressesTable.findFirst({
        where: and(
            eq(customerAddressesTable.id, addressId),
            eq(customerAddressesTable.customerId, customerId),
            isNull(customerAddressesTable.deletedAt)
        ),
    });

    if (!existing) {
        throw new NotFoundError("Address not found");
    }

    // Soft delete target address
    await db
        .update(customerAddressesTable)
        .set({
            deletedAt: new Date(),
            isDefaultShipping: false,
            isDefaultBilling: false,
            updatedAt: new Date(),
        })
        .where(
            and(
                eq(customerAddressesTable.id, addressId),
                eq(customerAddressesTable.customerId, customerId)
            )
        );

    // If it was default shipping or billing, promote next candidate
    if (existing.isDefaultShipping || existing.isDefaultBilling) {
        const nextAddress = await db.query.customerAddressesTable.findFirst({
            where: and(
                eq(customerAddressesTable.customerId, customerId),
                isNull(customerAddressesTable.deletedAt)
            ),
            orderBy: [desc(customerAddressesTable.createdAt)],
        });

        if (nextAddress) {
            if (existing.isDefaultShipping) {
                await setDefaultAddress(customerId, nextAddress.id, "shipping", clientMeta);
            }
            if (existing.isDefaultBilling) {
                await setDefaultAddress(customerId, nextAddress.id, "billing", clientMeta);
            }
        }
    }

    await recordCustomerAuditLog({
        customerId,
        actorId: clientMeta?.actorId ?? null,
        actorType: clientMeta?.actorType ?? "customer",
        action: "address_deleted",
        changes: { addressId },
        headers: clientMeta?.headers,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
    });

    return { success: true, deletedAddressId: addressId };
}

/**
 * Admin: List customers with filtering, pagination, and sorting.
 */
export async function listCustomersAdmin(query: TCustomerListQuery): Promise<TCustomerAdminList> {
    const { page, limit, search, status, customerType, sortBy, sortOrder } = query;
    const offset = (page - 1) * limit;

    const conditions = [isNull(customersTable.deletedAt)];

    if (status) {
        conditions.push(eq(customersTable.status, status));
    }
    if (customerType) {
        conditions.push(eq(customersTable.customerType, customerType));
    }
    if (search && search.trim()) {
        const searchPattern = `%${search.trim()}%`;
        conditions.push(
            or(
                ilike(customersTable.email, searchPattern),
                ilike(customersTable.firstName, searchPattern),
                ilike(customersTable.lastName, searchPattern),
                ilike(customersTable.phone, searchPattern)
            )!
        );
    }

    const whereClause = and(...conditions);

    // Count total
    const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customersTable)
        .where(whereClause);

    const totalCount = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit);

    // Ordering
    const sortColumn = customersTable[sortBy] ?? customersTable.createdAt;
    const orderClause = sortOrder === "asc" ? sql`${sortColumn} asc` : sql`${sortColumn} desc`;

    const customers = await db.query.customersTable.findMany({
        where: whereClause,
        orderBy: [orderClause],
        limit,
        offset,
        with: {
            addresses: {
                where: isNull(customerAddressesTable.deletedAt),
            },
        },
    });

    const items = customers.map((c) => CustomerAdminDetailSchema.parse(c));

    return {
        items,
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
 * Admin: Get complete customer detail by ID.
 */
export async function getCustomerAdminById(id: string): Promise<TCustomerAdminDetail> {
    const customer = await db.query.customersTable.findFirst({
        where: eq(customersTable.id, id),
        with: {
            addresses: {
                where: isNull(customerAddressesTable.deletedAt),
                orderBy: [desc(customerAddressesTable.createdAt)],
            },
        },
    });

    if (!customer) {
        throw new NotFoundError("Customer not found");
    }

    return CustomerAdminDetailSchema.parse(customer);
}

/**
 * Admin: Update customer properties (riskScore, status, notes, tags, metadata, etc.).
 */
export async function updateCustomerAdmin(
    id: string,
    data: TAdminUpdateCustomerInput,
    clientMeta?: ClientAuditMeta
): Promise<TCustomerAdminDetail> {
    const existing = await db.query.customersTable.findFirst({
        where: eq(customersTable.id, id),
    });

    if (!existing) {
        throw new NotFoundError("Customer not found");
    }

    const [updated] = await db
        .update(customersTable)
        .set({
            ...(data.firstName !== undefined ? { firstName: data.firstName } : {}),
            ...(data.lastName !== undefined ? { lastName: data.lastName } : {}),
            ...(data.phone !== undefined ? { phone: data.phone } : {}),
            ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
            ...(data.riskScore !== undefined ? { riskScore: data.riskScore } : {}),
            ...(data.adminNotes !== undefined ? { adminNotes: data.adminNotes } : {}),
            ...(data.tags !== undefined ? { tags: data.tags } : {}),
            ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
            updatedAt: new Date(),
        })
        .where(eq(customersTable.id, id))
        .returning();

    if (!updated) {
        throw new NotFoundError("Customer not found");
    }

    // Record audit log for admin modifications with diff
    const diff: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && (existing as Record<string, unknown>)[key] !== val) {
            diff[key] = { from: (existing as Record<string, unknown>)[key], to: val };
        }
    }

    if (Object.keys(diff).length > 0) {
        let action: TCustomerAuditAction = "profile_updated";
        if (data.riskScore !== undefined && data.riskScore !== existing.riskScore) {
            action = "risk_score_adjusted";
        } else if (data.adminNotes !== undefined && data.adminNotes !== existing.adminNotes) {
            action = "admin_note_added";
        }

        await recordCustomerAuditLog({
            customerId: id,
            actorId: clientMeta?.actorId ?? null,
            actorType: clientMeta?.actorType ?? "admin",
            action,
            changes: diff,
            headers: clientMeta?.headers,
            ipAddress: clientMeta?.ipAddress,
            userAgent: clientMeta?.userAgent,
        });
    }

    return getCustomerAdminById(id);
}

/**
 * Check if a customer has any active or in-progress orders.
 * Returns boolean (currently false as orders module is separate).
 */
export async function checkActiveCustomerOrders(customerId: string): Promise<boolean> {
    if (!customerId) return false;
    // Orders table integration: when orders table is present,
    // query active orders (e.g. status in ['pending', 'processing', 'shipped']).
    return false;
}

/**
 * Export customer profile, addresses, and audit logs conforming to GDPR Right to Data Portability.
 */
export async function exportCustomerData(
    customerId: string,
    clientMeta?: ClientAuditMeta
): Promise<TCustomerDataExport> {
    const customer = await getCustomerProfile({ customerId });
    if (!customer) {
        throw new NotFoundError("Customer not found");
    }

    const auditLogs = await db.query.customerAuditLogsTable.findMany({
        where: eq(customerAuditLogsTable.customerId, customerId),
        orderBy: [desc(customerAuditLogsTable.createdAt)],
    });

    const exportPayload: TCustomerDataExport = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        customer,
        addresses: customer.addresses ?? [],
        auditLogs: auditLogs.map((log) => CustomerAuditLogDTOSchema.parse(log)),
    };

    await recordCustomerAuditLog({
        customerId,
        actorId: clientMeta?.actorId ?? customer.authUserId,
        actorType: clientMeta?.actorType ?? "customer",
        action: "data_exported",
        changes: {
            exportVersion: "1.0",
            totalAddresses: exportPayload.addresses.length,
            totalAuditLogs: exportPayload.auditLogs.length,
        },
        headers: clientMeta?.headers,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
    });

    return CustomerDataExportSchema.parse(exportPayload);
}

/**
 * GDPR Right to Erasure / Pseudonymization Pipeline.
 * 1. Verifies customer exists and is not already anonymized.
 * 2. Checks active orders safety gate.
 * 3. Verifies password (if credential provider) or confirmation text (if OAuth-only).
 * 4. Hard deletes customer addresses.
 * 5. Redacts previous audit logs changes/IP/UA for this customer.
 * 6. Anonymizes customer profile in customersTable.
 * 7. Deletes Better-Auth user from auth.user (cascading sessions and accounts).
 * 8. Records final customer_anonymized audit log.
 */
export async function anonymizeCustomer(
    customerId: string,
    authUserId: string,
    input: TCustomerAnonymizeInput,
    clientMeta?: ClientAuditMeta
): Promise<{ success: boolean; message: string }> {
    const customer = await db.query.customersTable.findFirst({
        where: eq(customersTable.id, customerId),
    });

    if (!customer) {
        throw new NotFoundError("Customer not found");
    }

    if (customer.isAnonymized) {
        throw new BadRequestError("Customer account is already anonymized");
    }

    const hasActiveOrders = await checkActiveCustomerOrders(customerId);
    if (hasActiveOrders) {
        throw new BadRequestError("Cannot anonymize account while orders are active or in progress");
    }

    // Verification check:
    // If user has a password in auth.account (providerId === 'credential'), verify input.password
    // If user is OAuth-only, require confirmationText === 'DELETE MY ACCOUNT'
    const credentialAccount = await db.query.account.findFirst({
        where: and(
            eq(account.userId, authUserId),
            eq(account.providerId, "credential")
        ),
    });

    if (credentialAccount?.password) {
        if (!input.password) {
            throw new BadRequestError("Password is required to confirm account deletion");
        }
        const isValid = await verifyPassword({
            hash: credentialAccount.password,
            password: input.password,
        });
        if (!isValid) {
            throw new BadRequestError("Invalid password provided");
        }
    } else {
        if (input.confirmationText !== "DELETE MY ACCOUNT") {
            throw new BadRequestError("Must type 'DELETE MY ACCOUNT' to confirm deletion");
        }
    }

    // Record anonymization request
    await recordCustomerAuditLog({
        customerId,
        actorId: authUserId,
        actorType: "customer",
        action: "anonymization_requested",
        changes: { reason: "gdpr_erasure_request" },
        headers: clientMeta?.headers,
        ipAddress: clientMeta?.ipAddress,
        userAgent: clientMeta?.userAgent,
    });

    // Hard delete customer addresses
    await db.delete(customerAddressesTable).where(eq(customerAddressesTable.customerId, customerId));

    // Redact previous customer audit logs changes and network metadata
    await db
        .update(customerAuditLogsTable)
        .set({
            changes: { redacted: true, reason: "gdpr_erasure" },
            ipAddress: null,
            userAgent: null,
        })
        .where(eq(customerAuditLogsTable.customerId, customerId));

    // Anonymize customer profile record
    const anonymizedEmail = `anonymized_${randomUUID()}@deleted.local`;
    await db
        .update(customersTable)
        .set({
            email: anonymizedEmail,
            firstName: "Anonymized",
            lastName: "",
            phone: null,
            avatarUrl: null,
            adminNotes: null,
            tags: [],
            metadata: {},
            status: "archived",
            isAnonymized: true,
            anonymizedAt: new Date(),
            authUserId: null,
            updatedAt: new Date(),
        })
        .where(eq(customersTable.id, customerId));

    // Delete Better-Auth user from auth.user (cascades sessions and accounts)
    await db.delete(user).where(eq(user.id, authUserId));

    // Insert final audit log
    const networkMeta = extractClientNetworkMeta(clientMeta?.headers);
    await db.insert(customerAuditLogsTable).values({
        customerId,
        actorId: authUserId,
        actorType: "customer",
        action: "customer_anonymized",
        changes: {
            reason: "gdpr_erasure_completed",
            anonymizedAt: new Date().toISOString(),
        },
        ipAddress: clientMeta?.ipAddress ?? networkMeta.ipAddress,
        userAgent: clientMeta?.userAgent ?? networkMeta.userAgent,
    });

    return {
        success: true,
        message: "Customer account successfully anonymized and deleted",
    };
}

/**
 * Admin: Get paginated customer audit logs.
 */
export async function getCustomerAuditLogs(
    customerId: string,
    query: TCustomerAuditLogListQuery
): Promise<TCustomerAuditLogListResponse> {
    const customer = await db.query.customersTable.findFirst({
        where: eq(customersTable.id, customerId),
    });

    if (!customer) {
        throw new NotFoundError("Customer not found");
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(customerAuditLogsTable)
        .where(eq(customerAuditLogsTable.customerId, customerId));

    const totalCount = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const logs = await db.query.customerAuditLogsTable.findMany({
        where: eq(customerAuditLogsTable.customerId, customerId),
        orderBy: [desc(customerAuditLogsTable.createdAt)],
        limit,
        offset,
    });

    return {
        items: logs.map((l) => CustomerAuditLogDTOSchema.parse(l)),
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

const customerActions = {
    getOrCreateCustomer,
    getCustomerProfile,
    updateCustomerProfile,
    getCustomerAddresses,
    addCustomerAddress,
    updateCustomerAddress,
    deleteCustomerAddress,
    setDefaultAddress,
    listCustomersAdmin,
    getCustomerAdminById,
    updateCustomerAdmin,
    checkActiveCustomerOrders,
    exportCustomerData,
    anonymizeCustomer,
    getCustomerAuditLogs,
};

export default customerActions;
