import assert from "node:assert/strict";
import { POST as checkoutPost } from "@/app/api/v1/checkout/route";
import { POST as estimatePost } from "@/app/api/v1/checkout/estimate/route";
import { GET as orderGet } from "@/app/api/v1/checkout/[orderId]/route";
import { POST as cancelPost } from "@/app/api/v1/checkout/[orderId]/cancel/route";
import checkoutActions, { generateOrderNumber } from "@/features/checkout/actions";
import { calculateCheckoutPricing } from "@/features/checkout/pricing";
import {
    CheckoutAddressSchema,
    CheckoutProcessInputSchema,
    type TCheckoutAddress,
} from "@/features/checkout/types";
import type { TVariantCheckoutSnapshot } from "@/features/products/types";
import { db } from "@/lib/drizzle";
import { productsTable, productVariantsTable } from "@/lib/drizzle/schemas/public";
import { eq } from "drizzle-orm";

async function runCheckoutTestSuite() {
    console.log("=== Checkout API & Domain Test Suite ===");

    // -------------------------------------------------------------
    // 1. Order Number Generation
    // -------------------------------------------------------------
    console.log("-> 1. Testing Order Number Generation");
    const orderNum1 = generateOrderNumber();
    const orderNum2 = generateOrderNumber();
    assert(orderNum1 !== orderNum2, "Order numbers must be unique");
    assert(/^ORD-\d{8}-[A-F0-9]{8}$/.test(orderNum1), `Order number format matches: ${orderNum1}`);

    // -------------------------------------------------------------
    // 2. Checkout Address Schema Validation
    // -------------------------------------------------------------
    console.log("-> 2. Testing Checkout Address Validation");
    const validAddressInput = {
        recipientName: "John Doe",
        phone: "+1 (555) 234-5678",
        addressLine1: "123 Main St",
        city: "San Francisco",
        state: "CA",
        postalCode: "94105",
        countryCode: "us",
    };

    const parsedAddress = CheckoutAddressSchema.parse(validAddressInput);
    assert.equal(parsedAddress.recipientName, "John Doe");
    assert.equal(parsedAddress.phone, "+15552345678");
    assert.equal(parsedAddress.countryCode, "US");

    // Invalid phone
    assert.throws(() => {
        CheckoutAddressSchema.parse({
            ...validAddressInput,
            phone: "invalid-phone",
        });
    });

    // -------------------------------------------------------------
    // 3. Pricing & Consignment Logistics Calculation
    // -------------------------------------------------------------
    console.log("-> 3. Testing Pricing & Shipping Calculations");
    const mockPhysicalSnapshot: TVariantCheckoutSnapshot = {
        productId: "987e6543-e89b-12d3-a456-426614174001",
        variantId: "123e4567-e89b-12d3-a456-426614174001",
        sku: "test-hoodie-m",
        title: "Test Hoodie",
        variantTitle: "M / Navy",
        slug: "test-hoodie",
        imageUrl: null,
        currentPrice: 40.0,
        purchasePrice: 20.0,
        weight: 0.8,
        packageLength: 30,
        packageWidth: 20,
        packageHeight: 5,
        volumetricWeight: 0.6,
        chargeableWeight: 0.8,
        inventoryType: "discrete",
        allowBackorder: false,
        availableStock: 50,
        isUnlimited: false,
        isPurchasable: true,
        optionValues: {},
        status: "published",
        isActive: true,
    };

    // Subtotal = 80 (< 100 threshold), weight = 1.6kg -> base 10 + 0.6 * 2 = 11.20
    const pricing1 = calculateCheckoutPricing([{ snapshot: mockPhysicalSnapshot, quantity: 2 }]);
    assert.equal(pricing1.subtotal, 80.0);
    assert.equal(pricing1.shippingFee, 11.2);
    assert.equal(pricing1.totalAmount, 91.2);
    assert.equal(pricing1.logistics.hasPhysicalGoods, true);

    // Free shipping threshold (subtotal >= 100)
    const pricing2 = calculateCheckoutPricing([{ snapshot: mockPhysicalSnapshot, quantity: 3 }]);
    assert.equal(pricing2.subtotal, 120.0);
    assert.equal(pricing2.shippingFee, 0);
    assert.equal(pricing2.totalAmount, 120.0);

    // Digital item (no weight, no package dims)
    const mockDigitalSnapshot: TVariantCheckoutSnapshot = {
        ...mockPhysicalSnapshot,
        variantId: "123e4567-e89b-12d3-a456-426614174002",
        weight: null,
        packageLength: null,
        packageWidth: null,
        packageHeight: null,
        volumetricWeight: null,
        chargeableWeight: null,
        inventoryType: "no_tracking",
        isUnlimited: true,
    };
    const pricingDigital = calculateCheckoutPricing([{ snapshot: mockDigitalSnapshot, quantity: 1 }]);
    assert.equal(pricingDigital.subtotal, 40.0);
    assert.equal(pricingDigital.shippingFee, 0); // No shipping fee for non-physical consignment
    assert.equal(pricingDigital.totalAmount, 40.0);

    // -------------------------------------------------------------
    // 4. Database Integration & Checkout Actions
    // -------------------------------------------------------------
    console.log("-> 4. Testing End-to-End Checkout Flow in Database");

    // Fetch an existing active, in-stock variant from the seeded database
    const allVariants = await db.query.productVariantsTable.findMany({
        where: eq(productVariantsTable.isActive, true),
        with: { product: true },
    });

    const variant = allVariants.find(
        (v) =>
            v.isActive &&
            !v.deletedAt &&
            v.product?.status === "published" &&
            !v.product?.deletedAt &&
            (Number(v.stock) > 2 || Number(v.product.poolStock) > 2 || v.allowBackorder || v.product.allowBackorder)
    );

    if (!variant || !variant.product) {
        console.warn("⚠️ No suitable active in-stock variant found in DB, skipping live checkout insertion test");
        return;
    }

    const testAddress: TCheckoutAddress = {
        recipientName: "Test Customer",
        phone: "+15551234567",
        addressLine1: "789 Pine Road",
        city: "Seattle",
        state: "WA",
        postalCode: "98101",
        countryCode: "US",
    };

    // 4a. Estimate checkout endpoint test
    const estimate = await checkoutActions.estimateCheckout({
        items: [{ variantId: variant.id, quantity: 1 }],
        shippingAddress: testAddress,
    });
    assert.equal(estimate.items.length, 1);
    assert.equal(estimate.items[0]?.snapshot.variantId, variant.id);
    if (!estimate.isReadyForCheckout) {
        console.error("Estimate warnings:", estimate.warnings);
    }
    assert.equal(estimate.isReadyForCheckout, true, `Expected ready for checkout, warnings: ${estimate.warnings.join(", ")}`);
    assert(estimate.totalAmount > 0);

    // 4b. Execute Guest Checkout
    const initialVariantStock = Number(variant.stock);
    const guestOrder = await checkoutActions.processCheckout({
        items: [{ variantId: variant.id, quantity: 1 }],
        customer: {
            email: "guest.checkout.test@example.com",
            firstName: "Guest",
            lastName: "Tester",
            phone: "+15551234567",
        },
        shippingAddress: testAddress,
        paymentMethod: "cod",
    });

    assert(guestOrder.id, "Order ID generated");
    assert(guestOrder.orderNumber.startsWith("ORD-"), "Order number generated");
    assert.equal(guestOrder.customerEmail, "guest.checkout.test@example.com");
    assert.equal(guestOrder.status, "pending");
    assert.equal(guestOrder.items?.length, 1);
    assert.equal(guestOrder.items?.[0]?.variantId, variant.id);
    assert(guestOrder.guestAccessToken, "Guest order must return high-entropy guestAccessToken");
    assert.equal(guestOrder.guestAccessToken?.length, 64, "Token should be 32 bytes hex (64 chars)");

    // 4c. Verify stock decrement
    const updatedVariant = await db.query.productVariantsTable.findFirst({
        where: eq(productVariantsTable.id, variant.id),
    });
    if (variant.inventoryType === "discrete") {
        assert.equal(Number(updatedVariant?.stock), initialVariantStock - 1);
    }

    // 4d. Retrieve Order with Cryptographic Guest Access Token
    const fetchedOrder = await checkoutActions.getOrderById(guestOrder.id, {
        guestAccessToken: guestOrder.guestAccessToken,
    });
    assert.equal(fetchedOrder.id, guestOrder.id);

    // Insecure access with invalid token or email alone must be rejected
    await assert.rejects(
        () => checkoutActions.getOrderById(guestOrder.id, { guestAccessToken: "invalid-token-123456" }),
        { name: "ForbiddenError" }
    );
    await assert.rejects(
        () => checkoutActions.getOrderById(guestOrder.id, {}),
        { name: "ForbiddenError" }
    );

    // 4e. Cancel Order & Verify Inventory Release
    const cancelledOrder = await checkoutActions.cancelOrder(guestOrder.id, {
        isAdmin: true,
        reason: "Customer requested cancellation",
    });
    assert.equal(cancelledOrder.status, "cancelled");
    assert(cancelledOrder.cancelledAt !== null);

    // Verify stock restoration
    const restoredVariant = await db.query.productVariantsTable.findFirst({
        where: eq(productVariantsTable.id, variant.id),
    });
    if (variant.inventoryType === "discrete") {
        assert.equal(Number(restoredVariant?.stock), initialVariantStock);
    }

    // -------------------------------------------------------------
    // 5. API Route Handlers Integration
    // -------------------------------------------------------------
    console.log("-> 5. Testing Next.js Route Handlers (HTTP Layer)");

    // 5a. POST /api/v1/checkout/estimate
    const estimateReq = new Request("http://localhost:3000/api/v1/checkout/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            items: [{ variantId: variant.id, quantity: 2 }],
        }),
    });
    const estimateRes = await estimatePost(estimateReq);
    assert.equal(estimateRes.status, 200);
    const estimateJson = await estimateRes.json();
    assert.equal(estimateJson.items[0].snapshot.variantId, variant.id);

    // 5b. Invalid estimate request (empty items)
    const badEstimateReq = new Request("http://localhost:3000/api/v1/checkout/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
    });
    const badEstimateRes = await estimatePost(badEstimateReq);
    assert.equal(badEstimateRes.status, 400);

    // 5c. GET /api/v1/checkout/[orderId] (guest tracking with valid token)
    const getOrderReq = new Request(
        `http://localhost:3000/api/v1/checkout/${guestOrder.id}?token=${guestOrder.guestAccessToken}`
    );
    const getOrderRes = await orderGet(getOrderReq, {
        params: Promise.resolve({ orderId: guestOrder.id }),
    });
    assert.equal(getOrderRes.status, 200);
    const getOrderJson = await getOrderRes.json();
    assert.equal(getOrderJson.id, guestOrder.id);
    assert.equal(getOrderJson.guestAccessToken, undefined, "Token hash/plain token must not be leaked on subsequent gets");

    // 5d. GET /api/v1/checkout/[orderId] (unauthorized access with email query alone, without token)
    const unauthorizedReq = new Request(
        `http://localhost:3000/api/v1/checkout/${guestOrder.id}?email=guest.checkout.test@example.com`
    );
    const unauthorizedRes = await orderGet(unauthorizedReq, {
        params: Promise.resolve({ orderId: guestOrder.id }),
    });
    assert.equal(unauthorizedRes.status, 403);

    // 5e. POST /api/v1/checkout/[orderId]/cancel (unauthenticated cancellation without session or token)
    const cancelReq = new Request(
        `http://localhost:3000/api/v1/checkout/${guestOrder.id}/cancel`,
        { method: "POST" }
    );
    const cancelRes = await cancelPost(cancelReq, {
        params: Promise.resolve({ orderId: guestOrder.id }),
    });
    assert.equal(cancelRes.status, 401);

    console.log("✔ All Checkout API and Domain integration tests passed successfully! 🛍️");
}

runCheckoutTestSuite().catch((err) => {
    console.error("❌ Checkout test suite failed:", err);
    process.exit(1);
});
