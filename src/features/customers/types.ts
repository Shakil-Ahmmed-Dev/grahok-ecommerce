import {
    ADDRESS_TYPES,
    CUSTOMER_AUDIT_ACTIONS,
    CUSTOMER_AUDIT_ACTOR_TYPES,
    CUSTOMER_STATUSES,
    CUSTOMER_TYPES,
    customerAddressesTable,
    customerAuditLogsTable,
    customersTable,
    type TCustomerAuditAction,
    type TCustomerAuditActorType,
} from "@/lib/drizzle/schemas/public";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export {
    CUSTOMER_AUDIT_ACTIONS,
    CUSTOMER_AUDIT_ACTOR_TYPES,
    type TCustomerAuditAction,
    type TCustomerAuditActorType,
};

/**
 * E.164 phone regex: optional leading '+' followed by 1 to 15 digits.
 * Standard format: ^\+[1-9]\d{1,14}$
 */
export const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * ISO-3166-1 alpha-2 uppercase country code regex: exactly 2 uppercase letters.
 */
export const ISO_ALPHA2_COUNTRY_REGEX = /^[A-Z]{2}$/;

/**
 * Maximum active addresses per customer.
 */
export const MAX_CUSTOMER_ADDRESSES = 25;

/**
 * Sanitizes phone number by trimming and stripping whitespace, dashes, dots, and parentheses.
 * Leaves leading + intact if present.
 */
export const sanitizePhoneNumber = (phone: string): string => {
    return phone.trim().replace(/[\s\(\)\.\-]/g, "");
};

export const PhoneSchema = z
    .string()
    .trim()
    .transform((val) => sanitizePhoneNumber(val))
    .pipe(
        z.string().regex(E164_PHONE_REGEX, "Phone number must be a valid E.164 format (e.g. +1234567890)")
    );

export const CountryCodeSchema = z
    .string()
    .trim()
    .transform((val) => val.toUpperCase())
    .pipe(
        z.string().regex(ISO_ALPHA2_COUNTRY_REGEX, "Country code must be a valid ISO-3166-1 alpha-2 code (e.g. US, GB, BD)")
    );

export const CustomerTypeSchema = z.enum(CUSTOMER_TYPES);
export type TCustomerType = z.infer<typeof CustomerTypeSchema>;

export const CustomerStatusSchema = z.enum(CUSTOMER_STATUSES);
export type TCustomerStatus = z.infer<typeof CustomerStatusSchema>;

export const AddressTypeSchema = z.enum(ADDRESS_TYPES);
export type TAddressType = z.infer<typeof AddressTypeSchema>;

// Drizzle base select schemas
export const CustomerModelSchema = createSelectSchema(customersTable);
export type TCustomerModel = z.infer<typeof CustomerModelSchema>;

export const CustomerAddressModelSchema = createSelectSchema(customerAddressesTable);
export type TCustomerAddressModel = z.infer<typeof CustomerAddressModelSchema>;

// Address Input Schemas
export const CreateCustomerAddressSchema = z.object({
    recipientName: z.string().trim().min(1, "Recipient name is required").max(100),
    company: z.string().trim().max(100).nullable().optional(),
    phone: PhoneSchema,
    addressLine1: z.string().trim().min(1, "Address line 1 is required").max(255),
    addressLine2: z.string().trim().max(255).nullable().optional(),
    city: z.string().trim().min(1, "City is required").max(100),
    state: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().min(1, "Postal code is required").max(20),
    countryCode: CountryCodeSchema,
    addressType: AddressTypeSchema.default("both"),
    isDefaultShipping: z.boolean().default(false),
    isDefaultBilling: z.boolean().default(false),
});
export type TCreateCustomerAddressInput = z.infer<typeof CreateCustomerAddressSchema>;

export const UpdateCustomerAddressSchema = CreateCustomerAddressSchema.partial();
export type TUpdateCustomerAddressInput = z.infer<typeof UpdateCustomerAddressSchema>;

export const SetDefaultAddressTypeSchema = z.enum(["shipping", "billing"]);
export type TSetDefaultAddressType = z.infer<typeof SetDefaultAddressTypeSchema>;

// Profile Input Schemas
export const UpdateCustomerProfileSchema = z.object({
    firstName: z.string().trim().max(50).nullable().optional(),
    lastName: z.string().trim().max(50).nullable().optional(),
    phone: PhoneSchema.nullable().optional(),
    avatarUrl: z.string().url("Avatar URL must be a valid URL").trim().nullable().optional(),
});
export type TUpdateCustomerProfileInput = z.infer<typeof UpdateCustomerProfileSchema>;

// Admin Input Schemas
export const AdminUpdateCustomerSchema = z.object({
    firstName: z.string().trim().max(50).nullable().optional(),
    lastName: z.string().trim().max(50).nullable().optional(),
    phone: PhoneSchema.nullable().optional(),
    avatarUrl: z.string().url("Avatar URL must be a valid URL").trim().nullable().optional(),
    status: CustomerStatusSchema.optional(),
    riskScore: z.number().int().min(0).max(100).optional(),
    adminNotes: z.string().trim().nullable().optional(),
    tags: z.array(z.string().trim().min(1)).optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
});
export type TAdminUpdateCustomerInput = z.infer<typeof AdminUpdateCustomerSchema>;

// Customer DTO Output Schemas
export const CustomerAddressDTOSchema = z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid(),
    recipientName: z.string(),
    company: z.string().nullable(),
    phone: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string().nullable(),
    city: z.string(),
    state: z.string().nullable(),
    postalCode: z.string(),
    countryCode: z.string(),
    addressType: AddressTypeSchema,
    isDefaultShipping: z.boolean(),
    isDefaultBilling: z.boolean(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
});
export type TCustomerAddressDTO = z.infer<typeof CustomerAddressDTOSchema>;

export const CustomerPublicProfileSchema = z.object({
    id: z.string().uuid(),
    authUserId: z.string().nullable(),
    customerType: CustomerTypeSchema,
    status: CustomerStatusSchema,
    email: z.string().email(),
    firstName: z.string().nullable(),
    lastName: z.string().nullable(),
    phone: z.string().nullable(),
    avatarUrl: z.string().nullable(),
    totalOrders: z.number().int(),
    totalSpent: z.string().or(z.number()),
    lastOrderAt: z.date().or(z.string()).nullable(),
    createdAt: z.date().or(z.string()),
    updatedAt: z.date().or(z.string()),
    addresses: z.array(CustomerAddressDTOSchema).optional(),
});
export type TCustomerPublicProfile = z.infer<typeof CustomerPublicProfileSchema>;

export const CustomerAdminDetailSchema = CustomerPublicProfileSchema.extend({
    riskScore: z.number().int(),
    adminNotes: z.string().nullable(),
    tags: z.array(z.string()),
    metadata: z.record(z.string(), z.unknown()),
    isAnonymized: z.boolean(),
    anonymizedAt: z.date().or(z.string()).nullable(),
    deletedAt: z.date().or(z.string()).nullable(),
});
export type TCustomerAdminDetail = z.infer<typeof CustomerAdminDetailSchema>;

// Admin Customer Query & List Schemas
export const CustomerListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    search: z.string().trim().optional(),
    status: CustomerStatusSchema.optional(),
    customerType: CustomerTypeSchema.optional(),
    sortBy: z.enum(["createdAt", "totalSpent", "totalOrders", "lastOrderAt", "riskScore"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});
export type TCustomerListQuery = z.infer<typeof CustomerListQuerySchema>;

export const CustomerPaginationMetaSchema = z.object({
    totalCount: z.number().int(),
    page: z.number().int(),
    limit: z.number().int(),
    totalPages: z.number().int(),
    hasNextPage: z.boolean(),
    hasPrevPage: z.boolean(),
});
export type TCustomerPaginationMeta = z.infer<typeof CustomerPaginationMetaSchema>;

export const CustomerAdminListSchema = z.object({
    items: z.array(CustomerAdminDetailSchema),
    pagination: CustomerPaginationMetaSchema,
});
export type TCustomerAdminList = z.infer<typeof CustomerAdminListSchema>;

// Audit Log Model and DTO Schemas
export const CustomerAuditLogModelSchema = createSelectSchema(customerAuditLogsTable);
export type TCustomerAuditLogModel = z.infer<typeof CustomerAuditLogModelSchema>;

export const CustomerAuditLogDTOSchema = z.object({
    id: z.string().uuid(),
    customerId: z.string().uuid().nullable(),
    actorId: z.string().nullable(),
    actorType: z.string(),
    action: z.string(),
    changes: z.record(z.string(), z.unknown()),
    ipAddress: z.string().nullable(),
    userAgent: z.string().nullable(),
    createdAt: z.date().or(z.string()),
});
export type TCustomerAuditLogDTO = z.infer<typeof CustomerAuditLogDTOSchema>;

export const CustomerAuditLogListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
});
export type TCustomerAuditLogListQuery = z.infer<typeof CustomerAuditLogListQuerySchema>;

export const CustomerAuditLogListResponseSchema = z.object({
    items: z.array(CustomerAuditLogDTOSchema),
    pagination: CustomerPaginationMetaSchema,
});
export type TCustomerAuditLogListResponse = z.infer<typeof CustomerAuditLogListResponseSchema>;

// Anonymize & GDPR Portability Schemas
export const CustomerAnonymizeInputSchema = z.object({
    password: z.string().optional(),
    confirmationText: z.string().regex(/^DELETE MY ACCOUNT$/, "Must type 'DELETE MY ACCOUNT' to confirm"),
});
export type TCustomerAnonymizeInput = z.infer<typeof CustomerAnonymizeInputSchema>;

export const CustomerDataExportSchema = z.object({
    exportVersion: z.string().default("1.0"),
    exportedAt: z.string(),
    customer: CustomerPublicProfileSchema,
    addresses: z.array(CustomerAddressDTOSchema),
    auditLogs: z.array(CustomerAuditLogDTOSchema),
});
export type TCustomerDataExport = z.infer<typeof CustomerDataExportSchema>;

export interface ClientAuditMeta {
    actorId?: string | null;
    actorType?: "customer" | "admin" | "system";
    headers?: Headers;
    ipAddress?: string | null;
    userAgent?: string | null;
}

