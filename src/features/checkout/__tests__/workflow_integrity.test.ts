import assert from "node:assert/strict";
import { db } from "@/lib/drizzle";
import {
    orderStatusesTable,
    ordersTable,
    ORDER_STATUSES,
    type TOrderStatus,
} from "@/lib/drizzle/schemas/public";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";

async function runAdversarialIntegrityTests() {
    console.log("=== Configurable Order Workflow: Adversarial Database Integrity Tests ===");

    const testRunId = randomUUID().slice(0, 8);
    const dummyAddress = {
        recipientName: "Test Customer",
        phone: "+15551234567",
        addressLine1: "123 Test Street",
        city: "Test City",
        postalCode: "12345",
        countryCode: "US",
    };

    // -------------------------------------------------------------------------
    // TEST 1: Reject order creation with non-existent status code
    // -------------------------------------------------------------------------
    console.log("\n-> 1. Testing FK Constraint Rejection on Non-Existent Status...");
    let rejected = false;
    const invalidStatus = `fake_status_${testRunId}`;
    try {
        await db.insert(ordersTable).values({
            orderNumber: `ORD-INVALID-${testRunId}`,
            customerEmail: "invalid-status@example.com",
            status: invalidStatus as unknown as TOrderStatus,
            subtotal: "100.00",
            totalAmount: "100.00",
            shippingAddress: dummyAddress,
            billingAddress: dummyAddress,
        });
    } catch (err: unknown) {
        rejected = true;
        console.log("   Observed rejection error details:", {
            message: (err as Error).message,
            cause: (err as { cause?: unknown }).cause,
            err,
        });
        const msg = String(err) + " " + JSON.stringify((err as { cause?: unknown })?.cause || "");
        assert(
            msg.toLowerCase().includes("foreign key") ||
            msg.toLowerCase().includes("violates foreign key constraint") ||
            msg.toLowerCase().includes("orders_status_order_statuses_code_fk") ||
            (err as { code?: string }).code === "23503" ||
            ((err as { cause?: { code?: string } }).cause?.code === "23503"),
            "Error must be a foreign key violation from PostgreSQL"
        );
    }
    assert.equal(rejected, true, "PostgreSQL MUST reject order insertion with non-existent status");
    console.log("   ✔ Non-existent status correctly rejected by PostgreSQL FK constraint.");

    // -------------------------------------------------------------------------
    // TEST 2: Accept order creation with all 8 baseline statuses
    // -------------------------------------------------------------------------
    console.log("\n-> 2. Testing Acceptance of All 8 Baseline Statuses...");
    const createdOrderNumbers: string[] = [];
    try {
        for (const baselineStatus of ORDER_STATUSES) {
            const orderNum = `ORD-BASE-${baselineStatus}-${testRunId}`;
            createdOrderNumbers.push(orderNum);
            
            await db.insert(ordersTable).values({
                orderNumber: orderNum,
                customerEmail: `baseline-${baselineStatus}@example.com`,
                status: baselineStatus,
                subtotal: "50.00",
                totalAmount: "50.00",
                shippingAddress: dummyAddress,
                billingAddress: dummyAddress,
            });

            const inserted = await db.query.ordersTable.findFirst({
                where: eq(ordersTable.orderNumber, orderNum),
            });
            assert(inserted, `Order ${orderNum} should exist in database`);
            assert.equal(inserted.status, baselineStatus, `Order status must be ${baselineStatus}`);
            console.log(`   ✔ Baseline status '${baselineStatus}' accepted and verified.`);
        }
    } finally {
        // Clean up test orders
        for (const orderNum of createdOrderNumbers) {
            await db.delete(ordersTable).where(eq(ordersTable.orderNumber, orderNum)).catch(() => {});
        }
    }

    // -------------------------------------------------------------------------
    // TEST 3: Empirically verify ON UPDATE CASCADE on orders.status
    // -------------------------------------------------------------------------
    console.log("\n-> 3. Testing ON UPDATE CASCADE from order_statuses(code) -> orders(status)...");
    const sourceStatusCode = `tmp_src_${testRunId}`;
    const targetStatusCode = `tmp_tgt_${testRunId}`;
    const cascadeOrderNumber = `ORD-CASCADE-${testRunId}`;

    try {
        // 1. Insert temporary source status
        await db.insert(orderStatusesTable).values({
            code: sourceStatusCode,
            name: "Temporary Source Status",
            stageCategory: "open",
            refundRule: "none",
            restockRule: "none",
            isActive: true,
            position: 999,
        });

        // 2. Insert order referencing source status
        await db.insert(ordersTable).values({
            orderNumber: cascadeOrderNumber,
            customerEmail: "cascade-test@example.com",
            status: sourceStatusCode as unknown as TOrderStatus,
            subtotal: "75.00",
            totalAmount: "75.00",
            shippingAddress: dummyAddress,
            billingAddress: dummyAddress,
        });

        // Verify order status is sourceStatusCode
        const initialOrder = await db.query.ordersTable.findFirst({
            where: eq(ordersTable.orderNumber, cascadeOrderNumber),
        });
        assert.equal(initialOrder?.status, sourceStatusCode);

        // 3. Update order_statuses.code from sourceStatusCode to targetStatusCode
        await db.update(orderStatusesTable)
            .set({ code: targetStatusCode, name: "Temporary Target Status" })
            .where(eq(orderStatusesTable.code, sourceStatusCode));

        // 4. Query order again: orders.status must have cascaded to targetStatusCode
        const cascadedOrder = await db.query.ordersTable.findFirst({
            where: eq(ordersTable.orderNumber, cascadeOrderNumber),
        });
        assert.equal(
            cascadedOrder?.status,
            targetStatusCode,
            `orders.status must CASCADE to '${targetStatusCode}' when order_statuses.code is renamed`
        );
        console.log(`   ✔ CASCADE verified: order.status automatically updated from '${sourceStatusCode}' to '${targetStatusCode}'.`);

        // ---------------------------------------------------------------------
        // TEST 4: Empirically verify ON DELETE RESTRICT on orders.status
        // ---------------------------------------------------------------------
        console.log("\n-> 4. Testing ON DELETE RESTRICT on order_statuses(code)...");
        let deleteBlocked = false;
        try {
            await db.delete(orderStatusesTable).where(eq(orderStatusesTable.code, targetStatusCode));
        } catch (err: unknown) {
            deleteBlocked = true;
            console.log("   Observed delete restriction error details:", {
                message: (err as Error).message,
                cause: (err as { cause?: unknown }).cause,
            });
            const msg = String(err) + " " + JSON.stringify((err as { cause?: unknown })?.cause || "");
            assert(
                msg.toLowerCase().includes("foreign key") ||
                msg.toLowerCase().includes("violates foreign key constraint") ||
                msg.toLowerCase().includes("orders_status_order_statuses_code_fk") ||
                (err as { code?: string }).code === "23503" ||
                ((err as { cause?: { code?: string } }).cause?.code === "23503"),
                "Error must indicate foreign key deletion restriction"
            );
        }
        assert.equal(deleteBlocked, true, "Deleting an order status currently in use by an order MUST be restricted");
        console.log("   ✔ ON DELETE RESTRICT verified: PostgreSQL blocked status deletion while orders reference it.");

    } finally {
        // Clean up cascade test order and status
        await db.delete(ordersTable).where(eq(ordersTable.orderNumber, cascadeOrderNumber)).catch(() => {});
        await db.delete(orderStatusesTable).where(eq(orderStatusesTable.code, targetStatusCode)).catch(() => {});
        await db.delete(orderStatusesTable).where(eq(orderStatusesTable.code, sourceStatusCode)).catch(() => {});
    }

    // -------------------------------------------------------------------------
    // TEST 5: Verify new tracking columns (policySnapshot, refundAmount, restockStatus, deliveredAt, refundedAt)
    // -------------------------------------------------------------------------
    console.log("\n-> 5. Testing Extended Columns (policySnapshot, refundAmount, restockStatus, deliveredAt, refundedAt)...");
    const extendedOrderNum = `ORD-EXT-${testRunId}`;
    const testDeliveredAt = new Date("2026-10-15T12:00:00Z");
    const testRefundedAt = new Date("2026-10-16T15:30:00Z");

    try {
        await db.insert(ordersTable).values({
            orderNumber: extendedOrderNum,
            customerEmail: "extended-cols@example.com",
            status: "refunded",
            subtotal: "120.00",
            totalAmount: "120.00",
            shippingAddress: dummyAddress,
            billingAddress: dummyAddress,
            policySnapshot: {
                feeDeduction: 15.0,
                restockCondition: "inspected",
                workflowVersion: 1,
            },
            refundAmount: "105.00",
            restockStatus: "restocked",
            deliveredAt: testDeliveredAt,
            refundedAt: testRefundedAt,
        });

        const extOrder = await db.query.ordersTable.findFirst({
            where: eq(ordersTable.orderNumber, extendedOrderNum),
        });

        assert(extOrder, "Extended order must exist");
        assert.equal(extOrder.restockStatus, "restocked");
        assert.equal(extOrder.refundAmount, "105.00");
        assert.deepEqual(extOrder.policySnapshot, {
            feeDeduction: 15.0,
            restockCondition: "inspected",
            workflowVersion: 1,
        });
        assert(extOrder.deliveredAt instanceof Date, "deliveredAt must be a Date instance");
        assert(extOrder.refundedAt instanceof Date, "refundedAt must be a Date instance");
        assert.equal(extOrder.deliveredAt.toISOString(), testDeliveredAt.toISOString());
        assert.equal(extOrder.refundedAt.toISOString(), testRefundedAt.toISOString());
        console.log("   ✔ Extended tracking columns verified with exact data roundtrip.");
    } finally {
        await db.delete(ordersTable).where(eq(ordersTable.orderNumber, extendedOrderNum)).catch(() => {});
    }

    // -------------------------------------------------------------------------
    // TEST 6: Verify default status on ordersTable is 'pending'
    // -------------------------------------------------------------------------
    console.log("\n-> 6. Testing Default Order Status...");
    const defaultOrderNum = `ORD-DEF-${testRunId}`;
    try {
        await db.insert(ordersTable).values({
            orderNumber: defaultOrderNum,
            customerEmail: "default-status@example.com",
            subtotal: "40.00",
            totalAmount: "40.00",
            shippingAddress: dummyAddress,
            billingAddress: dummyAddress,
        });

        const defOrder = await db.query.ordersTable.findFirst({
            where: eq(ordersTable.orderNumber, defaultOrderNum),
        });
        assert.equal(defOrder?.status, "pending", "Orders omitting status must default to 'pending'");
        assert.equal(defOrder?.restockStatus, "not_applicable", "restockStatus must default to 'not_applicable'");
        console.log("   ✔ Default status 'pending' and restockStatus 'not_applicable' verified.");
    } finally {
        await db.delete(ordersTable).where(eq(ordersTable.orderNumber, defaultOrderNum)).catch(() => {});
    }

    console.log("\n=======================================================================");
    console.log("✔ ALL ADVERSARIAL DATABASE INTEGRITY & STRESS TESTS PASSED EMPIRICALLY!");
    console.log("=======================================================================");
}

runAdversarialIntegrityTests().catch((err) => {
    console.error("Adversarial integrity tests failed:", err);
    process.exit(1);
});
