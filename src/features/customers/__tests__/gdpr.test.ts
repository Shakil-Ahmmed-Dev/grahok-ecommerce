import { extractClientNetworkMeta, sanitizeAuditChanges } from "@/features/customers/audit";
import {
    CustomerAnonymizeInputSchema,
    CustomerAuditLogDTOSchema,
    CustomerAuditLogListQuerySchema,
    CustomerDataExportSchema,
    CustomerPublicProfileSchema,
} from "@/features/customers/types";

async function runGdprTestSuite() {
    console.log("=== GDPR & Audit Logging Domain Test Suite ===");

    // -------------------------------------------------------------
    // 1. CustomerAnonymizeInputSchema validation
    // -------------------------------------------------------------
    console.log("-> 1. Testing CustomerAnonymizeInputSchema validation");

    // Valid OAuth confirmation without password
    const validOAuthInput = CustomerAnonymizeInputSchema.parse({
        confirmationText: "DELETE MY ACCOUNT",
    });
    console.assert(validOAuthInput.confirmationText === "DELETE MY ACCOUNT", "Valid OAuth anonymize confirmation");
    console.assert(validOAuthInput.password === undefined, "Password is optional");

    // Valid credential confirmation with password
    const validCredentialInput = CustomerAnonymizeInputSchema.parse({
        password: "SuperSecretPassword123!",
        confirmationText: "DELETE MY ACCOUNT",
    });
    console.assert(validCredentialInput.password === "SuperSecretPassword123!", "Password parsed correctly");
    console.assert(validCredentialInput.confirmationText === "DELETE MY ACCOUNT", "Confirmation text matches");

    // Invalid confirmation strings should throw
    const invalidConfirmations = [
        "delete my account",
        "DELETE",
        "delete",
        "PLEASE DELETE MY ACCOUNT",
        "",
        "DELETE MY ACCOUNT ",
    ];

    for (const badText of invalidConfirmations) {
        let threw = false;
        try {
            CustomerAnonymizeInputSchema.parse({
                confirmationText: badText,
            });
        } catch {
            threw = true;
        }
        console.assert(threw, `Expected rejection of invalid confirmation text: "${badText}"`);
    }

    // Missing confirmationText should throw
    let missingConfirmedThrew = false;
    try {
        CustomerAnonymizeInputSchema.parse({});
    } catch {
        missingConfirmedThrew = true;
    }
    console.assert(missingConfirmedThrew, "Rejects empty object without confirmationText");

    // -------------------------------------------------------------
    // 2. Sensitive Data Sanitization in Audit Logging
    // -------------------------------------------------------------
    console.log("-> 2. Testing Sensitive Data Sanitization in Audit Changes");

    const rawChanges = {
        firstName: { from: "Old", to: "New" },
        password: "cleartext_password_123",
        secretToken: "secret_jwt_token_xyz",
        nested: {
            userToken: "bearer_abc",
            email: "test@example.com",
            creditCardNumber: "4111111111111111",
        },
        safeNumber: 42,
        safeBool: true,
    };

    const sanitized = sanitizeAuditChanges(rawChanges);
    console.assert(sanitized.password === "[REDACTED]", "Redacts root password field");
    console.assert(sanitized.secretToken === "[REDACTED]", "Redacts root secretToken field");
    console.assert(sanitized.safeNumber === 42, "Preserves safeNumber");
    console.assert(sanitized.safeBool === true, "Preserves safeBool");

    const nestedSanitized = sanitized.nested as Record<string, unknown>;
    console.assert(nestedSanitized.userToken === "[REDACTED]", "Redacts nested userToken");
    console.assert(nestedSanitized.creditCardNumber === "[REDACTED]", "Redacts nested creditCardNumber");
    console.assert(nestedSanitized.email === "test@example.com", "Preserves safe nested email");

    // -------------------------------------------------------------
    // 3. Network Metadata Extraction from Headers
    // -------------------------------------------------------------
    console.log("-> 3. Testing Client Network Metadata Extraction");

    const headersWithForwarded = new Headers({
        "x-forwarded-for": "203.0.113.195, 70.41.3.18",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    });

    const meta1 = extractClientNetworkMeta(headersWithForwarded);
    console.assert(meta1.ipAddress === "203.0.113.195", "Extracts primary IP from x-forwarded-for");
    console.assert(meta1.userAgent?.includes("Mozilla"), "Extracts User Agent from headers");

    const headersWithRealIp = new Headers({
        "x-real-ip": "198.51.100.1",
        "user-agent": "GrahoK-Mobile/1.0",
    });

    const meta2 = extractClientNetworkMeta(headersWithRealIp);
    console.assert(meta2.ipAddress === "198.51.100.1", "Extracts IP from x-real-ip fallback");
    console.assert(meta2.userAgent === "GrahoK-Mobile/1.0", "Extracts custom mobile user-agent");

    const emptyMeta = extractClientNetworkMeta(undefined);
    console.assert(emptyMeta.ipAddress === null && emptyMeta.userAgent === null, "Handles undefined headers safely");

    // -------------------------------------------------------------
    // 4. CustomerAuditLogListQuerySchema validation & defaults
    // -------------------------------------------------------------
    console.log("-> 4. Testing CustomerAuditLogListQuerySchema");

    const defaultQuery = CustomerAuditLogListQuerySchema.parse({});
    console.assert(defaultQuery.page === 1, "Default page is 1");
    console.assert(defaultQuery.limit === 20, "Default limit is 20");

    const explicitQuery = CustomerAuditLogListQuerySchema.parse({
        page: "3",
        limit: "50",
    });
    console.assert(explicitQuery.page === 3, "Coerces page string to number");
    console.assert(explicitQuery.limit === 50, "Coerces limit string to number");

    let badLimitThrew = false;
    try {
        CustomerAuditLogListQuerySchema.parse({ limit: 101 }); // Exceeds max 100
    } catch {
        badLimitThrew = true;
    }
    console.assert(badLimitThrew, "Rejects limit exceeding 100");

    // -------------------------------------------------------------
    // 5. GDPR Right to Data Portability Export Schema Formatting
    // -------------------------------------------------------------
    console.log("-> 5. Testing GDPR Data Export Schema Formatting");

    const sampleCustomer = CustomerPublicProfileSchema.parse({
        id: "a0000000-0000-4000-8000-000000000001",
        authUserId: "auth-user-123",
        customerType: "registered",
        status: "active",
        email: "alice@example.com",
        firstName: "Alice",
        lastName: "Smith",
        phone: "+15551234567",
        avatarUrl: "https://example.com/avatar.png",
        totalOrders: 3,
        totalSpent: "250.00",
        lastOrderAt: "2026-10-18T10:00:00.000Z",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-10-18T10:00:00.000Z",
    });

    const sampleAuditLogs = [
        CustomerAuditLogDTOSchema.parse({
            id: "b0000000-0000-4000-8000-000000000001",
            customerId: "a0000000-0000-4000-8000-000000000001",
            actorId: "auth-user-123",
            actorType: "customer",
            action: "profile_updated",
            changes: { firstName: { from: "Alicia", to: "Alice" } },
            ipAddress: "203.0.113.195",
            userAgent: "Mozilla/5.0",
            createdAt: new Date().toISOString(),
        }),
    ];

    const exportObject = {
        exportVersion: "1.0",
        exportedAt: new Date().toISOString(),
        customer: sampleCustomer,
        addresses: [],
        auditLogs: sampleAuditLogs,
    };

    const validatedExport = CustomerDataExportSchema.parse(exportObject);
    console.assert(validatedExport.exportVersion === "1.0", "Export version is 1.0");
    console.assert(validatedExport.customer.email === "alice@example.com", "Customer email matches in export");
    console.assert(validatedExport.auditLogs.length === 1, "Audit logs included in export");
    console.assert(validatedExport.auditLogs[0]?.action === "profile_updated", "Audit log action preserved in export");

    console.log("✔ All GDPR and Security Audit Logging unit tests passed successfully! 🛡️");
}

runGdprTestSuite().catch((err) => {
    console.error("GDPR Test failed:", err);
    process.exit(1);
});
