import { requireAuthUser } from "@/features/auth/middlewares";
import customerActions from "@/features/customers/actions";
import { CustomerAnonymizeInputSchema } from "@/features/customers/types";
import { errorResponse, handleError } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit/rate-limiter";

export const POST = async (request: Request) => {
    try {
        const user = await requireAuthUser(request.headers);

        // Rate limit: 3 requests per 15 minutes (900 seconds)
        const rateLimit = await checkRateLimit(`customer:anonymize:${user.id}`, 3, 900);
        if (!rateLimit.success) {
            return errorResponse("Too many requests", 429, { retryAfter: rateLimit.retryAfter });
        }

        const customer = await customerActions.getOrCreateCustomer(user.id, user.email, user.name);
        const body = await request.json();
        const validated = CustomerAnonymizeInputSchema.parse(body);

        const result = await customerActions.anonymizeCustomer(customer.id, user.id, validated, {
            actorId: user.id,
            actorType: "customer",
            headers: request.headers,
        });

        const headers = new Headers();
        headers.append(
            "Set-Cookie",
            "better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax"
        );
        headers.append(
            "Set-Cookie",
            "__Secure-better-auth.session_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax; Secure"
        );

        return Response.json(result, {
            status: 200,
            headers,
        });
    } catch (err) {
        return handleError(err);
    }
};
