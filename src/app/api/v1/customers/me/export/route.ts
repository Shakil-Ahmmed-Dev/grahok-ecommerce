import { requireAuthUser } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { errorResponse, handleError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit/rate-limiter";

export const GET = async (request: Request) => {
    try {
        const user = await requireAuthUser(request.headers);

        // Rate limit: 5 requests per 10 minutes (600 seconds)
        const rateLimit = await checkRateLimit(`customer:export:${user.id}`, 5, 600);
        if (!rateLimit.success) {
            return errorResponse("Too many requests", 429, { retryAfter: rateLimit.retryAfter });
        }

        const customer = await customerActions.getOrCreateCustomer(
            user.id,
            user.email,
            user.name,
            user.emailVerified
        );
        const exportData = await customerActions.exportCustomerData(customer.id, {
            actorId: user.id,
            actorType: "customer",
            headers: request.headers,
        });

        const jsonString = JSON.stringify(exportData, null, 2);

        return new Response(jsonString, {
            status: 200,
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Disposition": `attachment; filename="grahok-customer-export-${customer.id}.json"`,
            },
        });
    } catch (err) {
        return handleError(err);
    }
};
