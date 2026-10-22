import assert from "node:assert/strict";
import {
    buildAtomicDefaultAddressSql,
    buildCustomerIdentityLinkCondition,
} from "@/features/customers/actions";
import { POST as anonymizePost } from "@/app/api/v1/customers/me/anonymize/route";
import { ForbiddenError, NotFoundError } from "@/lib/error";
import { handleError } from "@/lib/http";
import {
    assertCustomerSelfServiceAccess,
    canCustomerUseSelfService,
    customerProfileForSelfService,
    customerIdentityLinkDeniedError,
    decideCustomerIdentityLink,
} from "@/features/customers/self-service-policy";
import {
    CreateCustomerAddressSchema,
    CustomerAdminDetailSchema,
    CustomerPublicProfileSchema,
    MAX_CUSTOMER_ADDRESSES,
    PhoneSchema,
    UpdateCustomerAddressSchema,
    UpdateCustomerProfileSchema,
    sanitizePhoneNumber,
} from "@/features/customers/types";
import { PgDialect } from "drizzle-orm/pg-core";

const dialect = new PgDialect();

async function runCustomersTestSuite() {
    console.log("=== Customer Domain Test Suite ===");

    // -------------------------------------------------------------
    // 1. Phone number sanitization and E.164 validation
    // -------------------------------------------------------------
    console.log("-> 1. Testing Phone number sanitization and E.164 validation");
    const rawInputs = [
        { input: "+1 (555) 234-5678", expected: "+15552345678" },
        { input: "+880 1712-345678", expected: "+8801712345678" },
        { input: "   +44.20.7946.0958  ", expected: "+442079460958" },
    ];

    for (const { input, expected } of rawInputs) {
        const sanitized = sanitizePhoneNumber(input);
        assert(sanitized === expected, `Sanitizer failed for ${input}: got ${sanitized}`);
        const parsed = PhoneSchema.parse(input);
        assert(parsed === expected, `PhoneSchema parse failed for ${input}: got ${parsed}`);
    }

    const invalidPhones = [
        "01712345678", // Missing '+'
        "+0123456789", // Starts with 0 after +
        "+1234567890123456", // 16 digits (exceeds 15)
        "+abc",
        "",
    ];

    for (const bad of invalidPhones) {
        let threw = false;
        try {
            PhoneSchema.parse(bad);
        } catch {
            threw = true;
        }
        assert(threw, `Expected PhoneSchema to reject invalid phone: ${bad}`);
    }

    // -------------------------------------------------------------
    // 2. Address validation & Country code uppercase normalization
    // -------------------------------------------------------------
    console.log("-> 2. Testing Address validation and Country code normalization");
    const validAddressInput = {
        recipientName: "Alice Wonderland",
        phone: "+1 555 123 4567",
        addressLine1: "123 Wonderland Ave",
        city: "Fantasy City",
        postalCode: "12345",
        countryCode: "us", // lowercase, should normalize to US
    };

    const parsedAddress = CreateCustomerAddressSchema.parse(validAddressInput);
    assert(parsedAddress.countryCode === "US", "Country code normalized to uppercase US");
    assert(parsedAddress.phone === "+15551234567", "Phone parsed and formatted to E.164");
    assert(parsedAddress.addressType === "both", "Default address type is 'both'");
    assert(parsedAddress.isDefaultShipping === false, "Default isDefaultShipping is false");
    assert(parsedAddress.isDefaultBilling === false, "Default isDefaultBilling is false");

    // Invalid country code (not 2 uppercase letters)
    let badCountryThrew = false;
    try {
        CreateCustomerAddressSchema.parse({
            ...validAddressInput,
            countryCode: "USA",
        });
    } catch {
        badCountryThrew = true;
    }
    assert(badCountryThrew, "Rejects 3-letter country code USA");

    // Address quota constant
    assert(MAX_CUSTOMER_ADDRESSES === 25, "Address quota guard is set to 25");

    // -------------------------------------------------------------
    // 3. Update schemas (partial updates)
    // -------------------------------------------------------------
    console.log("-> 3. Testing Partial Address and Profile updates");
    const partialAddress = UpdateCustomerAddressSchema.parse({
        recipientName: "Alice New Name",
    });
    assert(partialAddress.recipientName === "Alice New Name", "Partial address update works");

    const validProfileUpdate = UpdateCustomerProfileSchema.parse({
        firstName: "Jane",
        lastName: "Doe",
        phone: "+1 800 555 0199",
        avatarUrl: "https://example.com/avatar.png",
    });
    assert(validProfileUpdate.firstName === "Jane", "Profile update parsed firstName");
    assert(validProfileUpdate.phone === "+18005550199", "Profile update parsed phone");

    // -------------------------------------------------------------
    // 4. DTO Separation (Public Profile vs Admin Detail)
    // -------------------------------------------------------------
    console.log("-> 4. Testing DTO Separation (Public Profile vs Admin Detail)");
    const sampleDbCustomer = {
        id: "d9e8f7c6-b5a4-4321-9876-abcdef123456",
        authUserId: "auth-user-999",
        customerType: "registered" as const,
        status: "active" as const,
        email: "customer@example.com",
        firstName: "John",
        lastName: "Doe",
        phone: "+15550001122",
        avatarUrl: "https://example.com/john.jpg",
        riskScore: 42,
        adminNotes: "VIP customer - handle with care",
        tags: ["vip", "early-adopter"],
        metadata: { tier: "gold" },
        totalOrders: 15,
        totalSpent: "1450.75",
        lastOrderAt: new Date("2026-10-15T12:00:00Z"),
        isAnonymized: false,
        anonymizedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-10-15T12:00:00Z"),
        deletedAt: null,
    };

    const publicDto = CustomerPublicProfileSchema.parse(sampleDbCustomer);
    // Sensitive fields should not exist in public profile schema shape
    assert(!("riskScore" in publicDto), "Public DTO does NOT contain riskScore");
    assert(!("adminNotes" in publicDto), "Public DTO does NOT contain adminNotes");
    assert(!("isAnonymized" in publicDto), "Public DTO does NOT contain isAnonymized");
    assert(publicDto.email === "customer@example.com", "Public DTO contains customer email");

    const adminDto = CustomerAdminDetailSchema.parse(sampleDbCustomer);
    assert(adminDto.riskScore === 42, "Admin DTO preserves riskScore");
    assert(adminDto.adminNotes === "VIP customer - handle with care", "Admin DTO preserves adminNotes");
    assert(adminDto.isAnonymized === false, "Admin DTO preserves isAnonymized");
    assert(adminDto.tags[0] === "vip", "Admin DTO preserves tags");

    // -------------------------------------------------------------
    // 5. Atomic Default Address Swap SQL Construction
    // -------------------------------------------------------------
    console.log("-> 5. Testing Atomic Default Address Swap SQL Construction");
    const testCustomerId = "11111111-1111-1111-1111-111111111111";
    const testAddressId = "22222222-2222-2222-2222-222222222222";

    const shippingSqlObj = buildAtomicDefaultAddressSql(testCustomerId, testAddressId, "is_default_shipping");
    const shippingQuery = dialect.sqlToQuery(shippingSqlObj);

    assert(
        shippingQuery.sql.includes("UPDATE customer_addresses"),
        "Shipping query updates customer_addresses table"
    );
    assert(
        shippingQuery.sql.includes("SET is_default_shipping = (id ="),
        "Shipping query uses CASE boolean equality (id = target)"
    );
    assert(
        shippingQuery.sql.includes("WHERE customer_id ="),
        "Shipping query filters by customer_id"
    );
    assert(
        shippingQuery.sql.includes("is_default_shipping = true"),
        "Shipping query resets previous default in single atomic statement"
    );
    assert(
        shippingQuery.sql.includes("deleted_at IS NULL"),
        "Shipping query respects soft delete"
    );

    const billingSqlObj = buildAtomicDefaultAddressSql(testCustomerId, testAddressId, "is_default_billing");
    const billingQuery = dialect.sqlToQuery(billingSqlObj);
    assert(
        billingQuery.sql.includes("SET is_default_billing = (id ="),
        "Billing query uses CASE boolean equality (id = target)"
    );

    // -------------------------------------------------------------
    // 6. Customer identity linking and self-service authorization
    // -------------------------------------------------------------
    console.log("-> 6. Testing Customer identity linking and self-service authorization");

    const identityInput = {
        authUserId: null,
        customerStatus: "active",
        deletedAt: null,
        requesterAuthUserId: "auth-user-new",
        emailVerified: true,
    };
    assert(
        decideCustomerIdentityLink({ ...identityInput, emailVerified: false }) === "reject",
        "Unverified email cannot claim an existing guest customer"
    );
    assert(
        decideCustomerIdentityLink({
            ...identityInput,
            authUserId: "auth-user-other",
        }) === "reject",
        "A normalized email linked to another auth identity is rejected"
    );
    assert(
        decideCustomerIdentityLink({
            ...identityInput,
            deletedAt: new Date(),
        }) === "reject",
        "A deleted email match is rejected and not restored"
    );
    assert(
        decideCustomerIdentityLink(identityInput) === "claim",
        "A verified identity can claim an active unlinked customer"
    );
    assert(
        decideCustomerIdentityLink({
            ...identityInput,
            authUserId: "auth-user-new",
            emailVerified: false,
        }) === "owned",
        "An existing auth identity remains owned without rechecking email verification"
    );

    const linkCondition = dialect.sqlToQuery(
        buildCustomerIdentityLinkCondition(testCustomerId, "guest@example.com")
    );
    const normalizedLinkSql = linkCondition.sql.toLowerCase().replaceAll('"', "");
    assert(normalizedLinkSql.includes("auth_user_id is null"), "Identity claim only updates an unowned row");
    assert(normalizedLinkSql.includes("deleted_at is null"), "Identity claim cannot restore deleted customers");
    assert(normalizedLinkSql.includes("status ="), "Identity claim requires the active status");
    assert(normalizedLinkSql.includes("lower("), "Identity claim uses the normalized email match");

    const capabilities = ["profileRead", "profileWrite", "addresses", "export"] as const;
    for (const capability of capabilities) {
        assert(canCustomerUseSelfService("active", capability), `Active customer can ${capability}`);
        assert(
            canCustomerUseSelfService("suspended", capability) === (capability === "profileRead"),
            `Suspended customer capability ${capability} follows read-only policy`
        );
        assert(!canCustomerUseSelfService("archived", capability), `Archived customer cannot ${capability}`);
        assert(!canCustomerUseSelfService("invalid", capability), `Unknown status cannot ${capability}`);
    }

    const suspendedProfile = customerProfileForSelfService({
        status: "suspended",
        email: "customer@example.com",
        addresses: [{ addressLine1: "private address" }],
    });
    assert(!Object.hasOwn(suspendedProfile, "addresses"), "Suspended profile omits addresses entirely");
    assert(suspendedProfile.email === "customer@example.com", "Suspended customer can read own profile");

    const activeProfile = customerProfileForSelfService({
        status: "active",
        addresses: [{ addressLine1: "active address" }],
    });
    assert(Object.hasOwn(activeProfile, "addresses"), "Active profile retains its addresses property");

    const identityDeniedResponse = handleError(customerIdentityLinkDeniedError());
    const identityDeniedBody = await identityDeniedResponse.json();
    assert(identityDeniedResponse.status === 404, "Identity claim failures do not disclose matching records");
    assert(
        JSON.stringify(identityDeniedBody) === JSON.stringify({
            success: false,
            error: {
                message: "Customer access is unavailable. Use account recovery if needed.",
            },
        }),
        "Identity claim failures use a generic recovery response without customer data"
    );

    assert.throws(
        () => assertCustomerSelfServiceAccess("suspended", "addresses"),
        ForbiddenError,
        "Suspended customer cannot read or write addresses"
    );
    assert.throws(
        () => assertCustomerSelfServiceAccess("suspended", "export"),
        ForbiddenError,
        "Suspended customer cannot export data"
    );
    assert.throws(
        () => assertCustomerSelfServiceAccess("archived", "profileRead"),
        NotFoundError,
        "Archived customer access is not disclosed"
    );
    assert.throws(
        () => assertCustomerSelfServiceAccess("invalid", "profileRead"),
        NotFoundError,
        "Unknown status is denied by default"
    );

    const suspendedAddressError = handleError(new ForbiddenError("Customer access is unavailable"));
    assert(suspendedAddressError.status === 403, "Suspended address access uses 403");
    assert(
        JSON.stringify(await suspendedAddressError.json()) ===
            JSON.stringify({
                success: false,
                error: { message: "Customer access is unavailable" },
            }),
        "Suspended address denial uses the standard non-PII error response"
    );

    const anonymizeResponse = await anonymizePost();
    assert(anonymizeResponse.status === 503, "Anonymization endpoint returns 503 while unavailable");
    assert(
        JSON.stringify(await anonymizeResponse.json()) === JSON.stringify({
            success: false,
            error: { message: "Customer account anonymization is currently unavailable" },
        }),
        "Anonymization endpoint returns the standard unavailable response"
    );
    assert(!anonymizeResponse.headers.has("set-cookie"), "Anonymization does not mutate auth cookies");

    console.log("✔ All Customer domain unit tests passed successfully! 🎯");
}

runCustomersTestSuite().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
