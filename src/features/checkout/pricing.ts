import {
    calculateConsignmentLogistics,
    roundToDecimals,
    type ConsignmentItemLogistics,
    type ConsignmentLogisticsResult,
} from "@/features/products/logistics";
import type { TVariantCheckoutSnapshot } from "@/features/products/types";
import {
    DEFAULT_BASE_SHIPPING_FEE,
    DEFAULT_CURRENCY,
    DEFAULT_TAX_RATE,
    FREE_SHIPPING_THRESHOLD,
    SHIPPING_RATE_PER_KG,
} from "./constants";

export interface CheckoutPricingItemInput {
    snapshot: TVariantCheckoutSnapshot;
    quantity: number;
}

export interface CheckoutPricingResult {
    subtotal: number;
    shippingFee: number;
    tax: number;
    discount: number;
    totalAmount: number;
    currency: string;
    logistics: ConsignmentLogisticsResult;
}

/**
 * Calculates line totals, consignment logistics, shipping fees, tax, and total amount for checkout.
 */
export function calculateCheckoutPricing(
    items: CheckoutPricingItemInput[],
    options?: {
        couponDiscount?: number;
        currency?: string;
    }
): CheckoutPricingResult {
    const currency = options?.currency ?? DEFAULT_CURRENCY;

    // 1. Calculate subtotal
    let rawSubtotal = 0;
    const consignmentItems: ConsignmentItemLogistics[] = [];

    for (const item of items) {
        const lineTotal = item.snapshot.currentPrice * item.quantity;
        rawSubtotal += lineTotal;

        consignmentItems.push({
            weight: item.snapshot.weight,
            packageLength: item.snapshot.packageLength,
            packageWidth: item.snapshot.packageWidth,
            packageHeight: item.snapshot.packageHeight,
            quantity: item.quantity,
        });
    }

    const subtotal = roundToDecimals(rawSubtotal, 2);

    // 2. Consignment logistics
    const logistics = calculateConsignmentLogistics(consignmentItems);

    // 3. Shipping fee
    let shippingFee = 0;
    if (logistics.hasPhysicalGoods) {
        if (subtotal >= FREE_SHIPPING_THRESHOLD) {
            shippingFee = 0;
        } else {
            const extraWeightKg = Math.max(0, logistics.chargeableWeight - 1);
            shippingFee = roundToDecimals(
                DEFAULT_BASE_SHIPPING_FEE + extraWeightKg * SHIPPING_RATE_PER_KG,
                2
            );
        }
    }

    // 4. Tax
    const tax = roundToDecimals(subtotal * DEFAULT_TAX_RATE, 2);

    // 5. Discount
    const rawDiscount = Math.max(0, options?.couponDiscount ?? 0);
    const discount = roundToDecimals(Math.min(rawDiscount, subtotal), 2);

    // 6. Grand total
    const totalAmount = roundToDecimals(
        Math.max(0, subtotal + shippingFee + tax - discount),
        2
    );

    return {
        subtotal,
        shippingFee,
        tax,
        discount,
        totalAmount,
        currency,
        logistics,
    };
}
