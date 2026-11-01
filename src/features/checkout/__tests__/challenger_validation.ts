import assert from "node:assert/strict";
import {
    OrderDTOSchema,
    CustomerOrderListQuerySchema,
} from "@/features/checkout/types";
import {
    ORDER_STATUSES,
    type TOrderStatus,
} from "@/features/checkout/constants";
import {
    ORDER_STAGE_CATEGORIES,
    ORDER_REFUND_RULES,
    ORDER_RESTOCK_RULES,
    ORDER_RESTOCK_STATUSES,
    orderStatusesTable,
    ordersTable,
} from "@/lib/drizzle/schemas/public";
import { db } from "@/lib/drizzle";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

async function runEmpiricalChallengerSuite() {
    console.log("=== Adversarial Challenger 2 Test Suite ===");

    const sampleBaseOrder = {
        id: randomUUID(),
        orderNumber: "ORD-20261101-00000001",
        customerId: null,
        customerType: "registered" as const,
        customerEmail: "challenger@example.com",
        customerName: "Challenger Test",
        customerPhone: "+15551234567",
        status: "pending" as TOrderStatus,
        paymentStatus: "pending" as const,
        paymentMethod: "cod" as const,
        currency: "BDT",
        subtotal: 100.0,
        shippingFee: 10.0,
        tax: 0.0,
        discount: 0.0,
        totalAmount: 110.0,
        shippingAddress: {
            recipientName: "Test Recipient",
            phone: "+15551234567",
            addressLine1: "123 Test St",
            city: "Test City",
            postalCode: "12345",
            countryCode: "US",
        },
        billingAddress: {
            recipientName: "Test Recipient",
            phone: "+15551234567",
            addressLine1: "123 Test St",
            city: "Test City",
            postalCode: "12345",
            countryCode: "US",
        },
        logistics: null,
        notes: null,
        metadata: {},
        guestAccessToken: null,
        cancelledAt: null,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [],
    };

    // -------------------------------------------------------------------------
    // Challenge 1: OrderDTOSchema.parse accepts all 8 baseline statuses
    // -------------------------------------------------------------------------
    console.log("-> 1. Testing OrderDTOSchema.parse with all 8 baseline statuses");
    const baseline8: readonly TOrderStatus[] = [
        "pending",
        "confirmed",
        "processing",
        "shipped",
        "in_transit",
        "delivered",
        "cancelled",
        "refunded",
    ];

    assert.equal(ORDER_STATUSES.length, 8, "ORDER_STATUSES array must have exactly 8 elements");

    for (const status of baseline8) {
        const orderData = {
            ...sampleBaseOrder,
            id: randomUUID(),
            status,
        };
        const parsed = OrderDTOSchema.parse(orderData);
        assert.equal(parsed.status, status, `OrderDTOSchema must preserve status: ${status}`);
    }
    console.log("   ✔ All 8 baseline statuses accepted by OrderDTOSchema.parse");

    // Adversarial: Test invalid statuses throw ZodError
    console.log("-> 1b. Testing OrderDTOSchema.parse rejects invalid statuses");
    const invalidStatuses = ["unknown", "completed", "draft", "", "PENDING", 123, null];
    for (const bad of invalidStatuses) {
        assert.throws(
            () => OrderDTOSchema.parse({ ...sampleBaseOrder, id: randomUUID(), status: bad }),
            `OrderDTOSchema.parse should reject invalid status: ${bad}`
        );
    }
    console.log("   ✔ Invalid statuses rejected as expected");

    // -------------------------------------------------------------------------
    // Challenge 2: CustomerOrderListQuerySchema validation with all 8 statuses
    // -------------------------------------------------------------------------
    console.log("-> 2. Testing CustomerOrderListQuerySchema with all 8 statuses");
    for (const status of baseline8) {
        const query = {
            page: "1",
            limit: "20",
            status,
        };
        const parsed = CustomerOrderListQuerySchema.parse(query);
        assert.equal(parsed.status, status, `CustomerOrderListQuerySchema must parse status: ${status}`);
        assert.equal(parsed.page, 1);
        assert.equal(parsed.limit, 20);
    }

    // Optional status (omitted)
    const omittedQuery = CustomerOrderListQuerySchema.parse({});
    assert.equal(omittedQuery.status, undefined);
    assert.equal(omittedQuery.page, 1);
    assert.equal(omittedQuery.limit, 20);

    // Adversarial: Invalid query status
    for (const bad of ["invalid", "COMPLETE", "open", "fulfillment"]) {
        assert.throws(
            () => CustomerOrderListQuerySchema.parse({ status: bad }),
            `CustomerOrderListQuerySchema should reject invalid status: ${bad}`
        );
    }
    console.log("   ✔ CustomerOrderListQuerySchema correctly handles all 8 statuses and rejects invalid ones");

    // -------------------------------------------------------------------------
    // Challenge 3: Edge case data for the new columns
    // -------------------------------------------------------------------------
    console.log("-> 3. Testing edge case data for new columns in DTO & Schema");

    // 3a. In OrderDTOSchema: verify passing new columns does not throw
    const complexNestedPolicy = {
        version: "v2.1",
        stageRule: "strict",
        gracePeriodMinutes: 120,
        refundRules: {
            policyType: "deduct_shipping_and_fee",
            feeAmount: 15.75,
            deductions: [
                { type: "restocking", rate: 0.1, max: 50 },
                { type: "inspection", fee: 5.0 },
            ],
        },
        metadata: {
            tags: ["fragile", "international"],
            audit: { createdBy: "admin_user_42", timestamp: "2026-11-01T03:00:00Z" },
        },
    };

    const orderWithNewColumns = {
        ...sampleBaseOrder,
        id: randomUUID(),
        policySnapshot: complexNestedPolicy,
        refundAmount: "123.45",
        restockStatus: "pending_inspection" as const,
        deliveredAt: new Date("2026-11-01T02:00:00Z"),
        refundedAt: new Date("2026-11-01T02:30:00Z"),
    };

    // Parse with complex nested object
    const parsedWithCols = OrderDTOSchema.parse(orderWithNewColumns);
    assert.equal(parsedWithCols.id, orderWithNewColumns.id);

    // Parse with nulls for optional new columns
    const orderWithNullCols = {
        ...sampleBaseOrder,
        id: randomUUID(),
        policySnapshot: null,
        refundAmount: null,
        restockStatus: "not_applicable" as const,
        deliveredAt: null,
        refundedAt: null,
    };
    const parsedWithNulls = OrderDTOSchema.parse(orderWithNullCols);
    assert.equal(parsedWithNulls.id, orderWithNullCols.id);
    console.log("   ✔ OrderDTOSchema cleanly handles objects containing new columns without collision");

    // -------------------------------------------------------------------------
    // Challenge 4: Database live verification with ordersTable
    // -------------------------------------------------------------------------
    console.log("-> 4. Testing live database table integrity with new columns and 8 statuses");

    // Verify baseline 8 statuses exist in order_statuses table
    const dbStatuses = await db.select().from(orderStatusesTable);
    console.log(`   Found ${dbStatuses.length} order_statuses in database`);
    assert(dbStatuses.length >= 8, `Expected at least 8 order statuses in DB, found ${dbStatuses.length}`);

    const dbStatusCodes = new Set(dbStatuses.map((s) => s.code));
    for (const expectedCode of baseline8) {
        assert(dbStatusCodes.has(expectedCode), `Database must have order status: ${expectedCode}`);
    }
    console.log("   ✔ All 8 baseline order statuses present in order_statuses table");

    // Insert test order with complex edge case columns
    const testOrderId = randomUUID();
    const testOrderNumber = `ORD-CHALLENGE-${Date.now().toString().slice(-8)}`;

    console.log(`   Inserting test order ${testOrderId} with edge case values into DB...`);
    const [insertedOrder] = await db
        .insert(ordersTable)
        .values({
            id: testOrderId,
            orderNumber: testOrderNumber,
            customerEmail: "challenger.db@example.com",
            customerType: "registered",
            status: "delivered",
            paymentStatus: "paid",
            paymentMethod: "card",
            currency: "BDT",
            subtotal: "250.00",
            shippingFee: "15.00",
            tax: "20.00",
            discount: "10.00",
            totalAmount: "275.00",
            shippingAddress: sampleBaseOrder.shippingAddress,
            billingAddress: sampleBaseOrder.billingAddress,
            policySnapshot: complexNestedPolicy,
            refundAmount: "123.45",
            restockStatus: "restocked",
            deliveredAt: new Date("2026-11-01T02:00:00.000Z"),
            refundedAt: new Date("2026-11-01T02:30:00.000Z"),
        })
        .returning();

    assert.equal(insertedOrder.id, testOrderId);
    assert.equal(insertedOrder.status, "delivered");
    assert.equal(insertedOrder.refundAmount, "123.45");
    assert.equal(insertedOrder.restockStatus, "restocked");
    assert.deepEqual(insertedOrder.policySnapshot, complexNestedPolicy);
    assert(insertedOrder.deliveredAt instanceof Date);
    assert(insertedOrder.refundedAt instanceof Date);
    console.log("   ✔ DB insert with complex policySnapshot, refundAmount, restockStatus, deliveredAt, refundedAt passed");

    // Test inserting with nulls for new columns
    const testNullOrderId = randomUUID();
    const testNullOrderNumber = `ORD-CHALLENGE-NULL-${Date.now().toString().slice(-8)}`;

    const [insertedNullOrder] = await db
        .insert(ordersTable)
        .values({
            id: testNullOrderId,
            orderNumber: testNullOrderNumber,
            customerEmail: "challenger.null@example.com",
            customerType: "registered",
            status: "pending",
            paymentStatus: "pending",
            paymentMethod: "cod",
            currency: "BDT",
            subtotal: "50.00",
            shippingFee: "0.00",
            tax: "0.00",
            discount: "0.00",
            totalAmount: "50.00",
            shippingAddress: sampleBaseOrder.shippingAddress,
            billingAddress: sampleBaseOrder.billingAddress,
            policySnapshot: null,
            refundAmount: null,
            restockStatus: "not_applicable",
            deliveredAt: null,
            refundedAt: null,
        })
        .returning();

    assert.equal(insertedNullOrder.id, testNullOrderId);
    assert.equal(insertedNullOrder.policySnapshot, null);
    assert.equal(insertedNullOrder.refundAmount, null);
    assert.equal(insertedNullOrder.restockStatus, "not_applicable");
    assert.equal(insertedNullOrder.deliveredAt, null);
    assert.equal(insertedNullOrder.refundedAt, null);
    console.log("   ✔ DB insert with NULLs for new columns passed");

    // -------------------------------------------------------------------------
    // Challenge 5: Foreign Key Enforcement & Cascades
    // -------------------------------------------------------------------------
    console.log("-> 5. Testing foreign key enforcement on ordersTable.status");

    // 5a. Foreign key rejection on invalid status
    const fakeOrderId = randomUUID();
    const fakeOrderNumber = `ORD-FAKE-${Date.now().toString().slice(-8)}`;
    let fkRejected = false;
    try {
        await db.insert(ordersTable).values({
            id: fakeOrderId,
            orderNumber: fakeOrderNumber,
            customerEmail: "fake@example.com",
            customerType: "registered",
            status: "non_existent_status_xyz" as unknown as TOrderStatus,
            paymentStatus: "pending",
            paymentMethod: "cod",
            currency: "BDT",
            subtotal: "10.00",
            totalAmount: "10.00",
            shippingAddress: sampleBaseOrder.shippingAddress,
            billingAddress: sampleBaseOrder.billingAddress,
        });
    } catch (err: unknown) {
        fkRejected = true;
        const errorRecord = err as { message?: string; cause?: { message?: string; code?: string }; detail?: string; code?: string };
        const errMsg = `${errorRecord.message ?? ""} ${errorRecord.cause?.message ?? ""} ${errorRecord.detail ?? ""}`;
        assert(
            errMsg.includes("violates foreign key constraint") ||
            errMsg.includes("orders_status_order_statuses_code_fk") ||
            errorRecord.code === "23503" ||
            errorRecord.cause?.code === "23503",
            `Expected FK constraint error, got: ${errMsg}`
        );
    }
    assert.equal(fkRejected, true, "Database MUST reject status not present in order_statuses table!");
    console.log("   ✔ Foreign key violation correctly prevented insertion of invalid status");

    // Clean up test orders
    await db.delete(ordersTable).where(eq(ordersTable.id, testOrderId));
    await db.delete(ordersTable).where(eq(ordersTable.id, testNullOrderId));
    console.log("   ✔ Test orders cleaned up successfully from DB");

    // -------------------------------------------------------------------------
    // Challenge 6: Semantic Enums Integrity
    // -------------------------------------------------------------------------
    console.log("-> 6. Testing Semantic Enums definitions");
    assert.deepEqual([...ORDER_STAGE_CATEGORIES], [
        "open",
        "fulfillment",
        "shipped_docked",
        "in_transit",
        "completed",
        "cancelled",
        "refunded",
    ]);

    assert.deepEqual([...ORDER_REFUND_RULES], [
        "full",
        "deduct_shipping",
        "deduct_flat_fee",
        "deduct_percentage",
        "deduct_shipping_and_fee",
        "none",
    ]);

    assert.deepEqual([...ORDER_RESTOCK_RULES], [
        "immediate",
        "hold_for_inspection",
        "none",
    ]);

    assert.deepEqual([...ORDER_RESTOCK_STATUSES], [
        "not_applicable",
        "pending_inspection",
        "restocked",
    ]);
    console.log("   ✔ All 4 semantic enum sets match specification exactly");

    console.log("🎉 All Empirical Challenger 2 tests passed with zero failures!");
}

runEmpiricalChallengerSuite().catch((err) => {
    console.error("❌ Challenger test suite failed:", err);
    process.exit(1);
});
