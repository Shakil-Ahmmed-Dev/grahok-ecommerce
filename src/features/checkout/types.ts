import { CountryCodeSchema, PhoneSchema } from "@/features/customers/types";
import { VariantCheckoutSnapshotSchema, type TVariantCheckoutSnapshot } from "@/features/products/types";
import { type ConsignmentLogisticsResult } from "@/features/products/logistics";
import { CUSTOMER_TYPES } from "@/lib/drizzle/schemas/public";
import { z } from "zod";
import {
    ORDER_STATUSES,
    PAYMENT_METHODS,
    PAYMENT_STATUSES,
    type TOrderStatus,
    type TPaymentMethod,
    type TPaymentStatus,
} from "./constants";

export const CheckoutItemInputSchema = z.object({
    variantId: z.string().uuid("Invalid variant ID"),
    quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
});
export type TCheckoutItemInput = z.infer<typeof CheckoutItemInputSchema>;

export const CheckoutAddressSchema = z.object({
    recipientName: z.string().trim().min(1, "Recipient name is required").max(100),
    company: z.string().trim().max(100).nullable().optional(),
    phone: PhoneSchema,
    addressLine1: z.string().trim().min(1, "Address line 1 is required").max(255),
    addressLine2: z.string().trim().max(255).nullable().optional(),
    city: z.string().trim().min(1, "City is required").max(100),
    state: z.string().trim().max(100).nullable().optional(),
    postalCode: z.string().trim().min(1, "Postal code is required").max(20),
    countryCode: CountryCodeSchema,
});
export type TCheckoutAddress = z.infer<typeof CheckoutAddressSchema>;

export const CheckoutCustomerInputSchema = z.object({
    email: z.string().trim().email("Invalid email address"),
    firstName: z.string().trim().max(100).optional(),
    lastName: z.string().trim().max(100).optional(),
    phone: PhoneSchema.optional(),
});
export type TCheckoutCustomerInput = z.infer<typeof CheckoutCustomerInputSchema>;

export const CheckoutEstimateInputSchema = z.object({
    items: z.array(CheckoutItemInputSchema).min(1, "Cart cannot be empty"),
    shippingAddress: CheckoutAddressSchema.optional(),
    couponCode: z.string().trim().optional(),
});
export type TCheckoutEstimateInput = z.input<typeof CheckoutEstimateInputSchema>;
export type TCheckoutEstimateOutput = z.output<typeof CheckoutEstimateInputSchema>;

export const CheckoutSavedAddressRefSchema = z.object({
    addressId: z.string().uuid("Invalid address ID"),
});

export const CheckoutShippingAddressInputSchema = z.union([
    CheckoutSavedAddressRefSchema,
    CheckoutAddressSchema,
]);
export type TCheckoutShippingAddressInput = z.input<typeof CheckoutShippingAddressInputSchema>;

export const CheckoutBillingAddressInputSchema = z.union([
    z.object({ sameAsShipping: z.literal(true) }),
    CheckoutSavedAddressRefSchema,
    CheckoutAddressSchema,
]);
export type TCheckoutBillingAddressInput = z.input<typeof CheckoutBillingAddressInputSchema>;

export const CheckoutProcessInputSchema = z.object({
    items: z.array(CheckoutItemInputSchema).min(1, "Cart cannot be empty"),
    customer: CheckoutCustomerInputSchema.optional(),
    shippingAddress: CheckoutShippingAddressInputSchema,
    billingAddress: CheckoutBillingAddressInputSchema.optional(),
    saveShippingAddress: z.boolean().default(false),
    paymentMethod: z.enum(PAYMENT_METHODS).default("cod"),
    notes: z.string().trim().max(1000).optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
});
export type TCheckoutProcessInput = z.input<typeof CheckoutProcessInputSchema>;
export type TCheckoutProcessOutput = z.output<typeof CheckoutProcessInputSchema>;

export const OrderCancelInputSchema = z.object({
    reason: z.string().trim().max(500).optional(),
});
export type TOrderCancelInput = z.infer<typeof OrderCancelInputSchema>;

export const CustomerOrderListQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    status: z.enum(ORDER_STATUSES).optional(),
});
export type TCustomerOrderListQuery = z.infer<typeof CustomerOrderListQuerySchema>;

export const CheckoutEstimateItemSchema = z.object({
    snapshot: VariantCheckoutSnapshotSchema,
    quantity: z.number().int().positive(),
    lineTotal: z.number(),
    isPurchasable: z.boolean(),
    availabilityStatus: z.enum(["in_stock", "backorder", "out_of_stock", "inactive", "product_unavailable"]),
});
export type TCheckoutEstimateItem = z.infer<typeof CheckoutEstimateItemSchema>;

export const CheckoutEstimateResponseSchema = z.object({
    items: z.array(CheckoutEstimateItemSchema),
    subtotal: z.number(),
    shippingFee: z.number(),
    tax: z.number(),
    discount: z.number(),
    totalAmount: z.number(),
    currency: z.string(),
    logistics: z.custom<ConsignmentLogisticsResult>(),
    isReadyForCheckout: z.boolean(),
    warnings: z.array(z.string()),
});
export type TCheckoutEstimateResponse = z.infer<typeof CheckoutEstimateResponseSchema>;

export const OrderItemDTOSchema = z.object({
    id: z.string().uuid(),
    orderId: z.string().uuid(),
    productId: z.string().uuid().nullable(),
    variantId: z.string().uuid().nullable(),
    title: z.string(),
    variantTitle: z.string(),
    sku: z.string(),
    slug: z.string().nullable(),
    imageUrl: z.string().nullable(),
    unitPrice: z.coerce.number(),
    quantity: z.number(),
    totalPrice: z.coerce.number(),
    weight: z.coerce.number().nullable(),
    isBackordered: z.boolean(),
    snapshot: VariantCheckoutSnapshotSchema.nullable().optional(),
    createdAt: z.coerce.date(),
});
export type TOrderItemDTO = z.infer<typeof OrderItemDTOSchema>;

export const OrderDTOSchema = z.object({
    id: z.string().uuid(),
    orderNumber: z.string(),
    customerId: z.string().uuid().nullable(),
    customerType: z.enum(CUSTOMER_TYPES),
    customerEmail: z.string(),
    customerName: z.string().nullable(),
    customerPhone: z.string().nullable(),
    status: z.enum(ORDER_STATUSES),
    paymentStatus: z.enum(PAYMENT_STATUSES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    currency: z.string(),
    subtotal: z.coerce.number(),
    shippingFee: z.coerce.number(),
    tax: z.coerce.number(),
    discount: z.coerce.number(),
    totalAmount: z.coerce.number(),
    shippingAddress: CheckoutAddressSchema,
    billingAddress: CheckoutAddressSchema,
    logistics: z.record(z.string(), z.unknown()).nullable().optional(),
    notes: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
    guestAccessToken: z.string().nullable().optional(),
    cancelledAt: z.coerce.date().nullable().optional(),
    paidAt: z.coerce.date().nullable().optional(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    items: z.array(OrderItemDTOSchema).optional(),
});
export type TOrderDTO = z.infer<typeof OrderDTOSchema>;

export interface CustomerOrderListResponse {
    items: TOrderDTO[];
    pagination: {
        totalCount: number;
        page: number;
        limit: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}
