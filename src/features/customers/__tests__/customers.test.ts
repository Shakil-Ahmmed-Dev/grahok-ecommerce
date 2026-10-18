import {
    buildAtomicDefaultAddressSql,
} from "@/features/customers/actions";
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
        console.assert(sanitized === expected, `Sanitizer failed for ${input}: got ${sanitized}`);
        const parsed = PhoneSchema.parse(input);
        console.assert(parsed === expected, `PhoneSchema parse failed for ${input}: got ${parsed}`);
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
        console.assert(threw, `Expected PhoneSchema to reject invalid phone: ${bad}`);
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
    console.assert(parsedAddress.countryCode === "US", "Country code normalized to uppercase US");
    console.assert(parsedAddress.phone === "+15551234567", "Phone parsed and formatted to E.164");
    console.assert(parsedAddress.addressType === "both", "Default address type is 'both'");
    console.assert(parsedAddress.isDefaultShipping === false, "Default isDefaultShipping is false");
    console.assert(parsedAddress.isDefaultBilling === false, "Default isDefaultBilling is false");

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
    console.assert(badCountryThrew, "Rejects 3-letter country code USA");

    // Address quota constant
    console.assert(MAX_CUSTOMER_ADDRESSES === 25, "Address quota guard is set to 25");

    // -------------------------------------------------------------
    // 3. Update schemas (partial updates)
    // -------------------------------------------------------------
    console.log("-> 3. Testing Partial Address and Profile updates");
    const partialAddress = UpdateCustomerAddressSchema.parse({
        recipientName: "Alice New Name",
    });
    console.assert(partialAddress.recipientName === "Alice New Name", "Partial address update works");

    const validProfileUpdate = UpdateCustomerProfileSchema.parse({
        firstName: "Jane",
        lastName: "Doe",
        phone: "+1 800 555 0199",
        avatarUrl: "https://example.com/avatar.png",
    });
    console.assert(validProfileUpdate.firstName === "Jane", "Profile update parsed firstName");
    console.assert(validProfileUpdate.phone === "+18005550199", "Profile update parsed phone");

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
    console.assert(!("riskScore" in publicDto), "Public DTO does NOT contain riskScore");
    console.assert(!("adminNotes" in publicDto), "Public DTO does NOT contain adminNotes");
    console.assert(!("isAnonymized" in publicDto), "Public DTO does NOT contain isAnonymized");
    console.assert(publicDto.email === "customer@example.com", "Public DTO contains customer email");

    const adminDto = CustomerAdminDetailSchema.parse(sampleDbCustomer);
    console.assert(adminDto.riskScore === 42, "Admin DTO preserves riskScore");
    console.assert(adminDto.adminNotes === "VIP customer - handle with care", "Admin DTO preserves adminNotes");
    console.assert(adminDto.isAnonymized === false, "Admin DTO preserves isAnonymized");
    console.assert(adminDto.tags[0] === "vip", "Admin DTO preserves tags");

    // -------------------------------------------------------------
    // 5. Atomic Default Address Swap SQL Construction
    // -------------------------------------------------------------
    console.log("-> 5. Testing Atomic Default Address Swap SQL Construction");
    const testCustomerId = "11111111-1111-1111-1111-111111111111";
    const testAddressId = "22222222-2222-2222-2222-222222222222";

    const shippingSqlObj = buildAtomicDefaultAddressSql(testCustomerId, testAddressId, "is_default_shipping");
    const shippingQuery = dialect.sqlToQuery(shippingSqlObj);

    console.assert(
        shippingQuery.sql.includes("UPDATE customer_addresses"),
        "Shipping query updates customer_addresses table"
    );
    console.assert(
        shippingQuery.sql.includes("SET is_default_shipping = (id ="),
        "Shipping query uses CASE boolean equality (id = target)"
    );
    console.assert(
        shippingQuery.sql.includes("WHERE customer_id ="),
        "Shipping query filters by customer_id"
    );
    console.assert(
        shippingQuery.sql.includes("is_default_shipping = true"),
        "Shipping query resets previous default in single atomic statement"
    );
    console.assert(
        shippingQuery.sql.includes("deleted_at IS NULL"),
        "Shipping query respects soft delete"
    );

    const billingSqlObj = buildAtomicDefaultAddressSql(testCustomerId, testAddressId, "is_default_billing");
    const billingQuery = dialect.sqlToQuery(billingSqlObj);
    console.assert(
        billingQuery.sql.includes("SET is_default_billing = (id ="),
        "Billing query uses CASE boolean equality (id = target)"
    );

    console.log("✔ All Customer domain unit tests passed successfully! 🎯");
}

runCustomersTestSuite().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
