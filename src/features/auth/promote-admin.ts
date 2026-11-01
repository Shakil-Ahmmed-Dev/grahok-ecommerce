import { db } from "@/lib/drizzle";
import { user } from "@/lib/drizzle/schemas/auth";
import { customersTable } from "@/lib/drizzle/schemas/public";
import { eq, sql } from "drizzle-orm";

async function promoteAdmin() {
    const emailArg = process.argv[2]?.trim().toLowerCase();

    if (!emailArg) {
        console.error("Usage: pnpm admin:promote <email>");
        process.exit(1);
    }

    console.log(`Looking for user with email: ${emailArg}...`);

    const targetUser = await db.query.user.findFirst({
        where: eq(sql`LOWER(${user.email})`, emailArg),
    });

    if (!targetUser) {
        console.error(`❌ User '${emailArg}' not found in auth.user table.`);
        console.error("Please sign up first using Better Auth (e.g., via the auth API/storefront).");
        process.exit(1);
    }

    if (targetUser.role === "admin") {
        console.log(`ℹ️ User '${targetUser.email}' (ID: ${targetUser.id}) is already an admin.`);
    } else {
        await db
            .update(user)
            .set({
                role: "admin",
                updatedAt: new Date(),
            })
            .where(eq(user.id, targetUser.id));

        console.log(`✔ Successfully promoted '${targetUser.email}' (ID: ${targetUser.id}) to role 'admin'! 🛡️`);
    }

    // Ensure customer profile is linked if present
    const customer = await db.query.customersTable.findFirst({
        where: eq(sql`LOWER(${customersTable.email})`, emailArg),
    });

    if (customer && !customer.authUserId) {
        await db
            .update(customersTable)
            .set({
                authUserId: targetUser.id,
                customerType: "registered",
                updatedAt: new Date(),
            })
            .where(eq(customersTable.id, customer.id));
        console.log(`✔ Linked customer profile (${customer.id}) to auth user.`);
    }

    process.exit(0);
}

promoteAdmin().catch((err) => {
    console.error("Unexpected error promoting admin:", err);
    process.exit(1);
});
